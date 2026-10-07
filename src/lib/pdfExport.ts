import jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type UserOptions } from 'jspdf-autotable';
import type { Product, ServiceOrder, Transaction } from '../context/AppContext';
import {
  DAY_MS,
  SERIES_LIGHT,
  isBilledOS,
  osAmount,
  osBilledDate,
  parseDate,
  startOfDayAgo,
} from '../components/dashboard/utils';

// ---------------------------------------------------------------------------
// Base visual compartilhada por todos os relatórios (A4 paisagem, mm)
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const C = {
  text: [24, 24, 27] as RGB,
  muted: [113, 113, 122] as RGB,
  faint: [161, 161, 170] as RGB,
  border: [228, 228, 231] as RGB,
  track: [244, 244, 245] as RGB,
  bg: [250, 250, 250] as RGB,
  blue: [37, 99, 235] as RGB,
  green: [5, 150, 105] as RGB,
  red: [220, 38, 38] as RGB,
  amber: [217, 119, 6] as RGB,
  redBg: [254, 242, 242] as RGB,
  redBorder: [254, 202, 202] as RGB,
};

const M = 12; // margem lateral
const TOP_CONT = 20; // topo das páginas de continuação

export interface StoreInfo {
  storeName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
}

const brl = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const brlShort = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(val || 0);
const num = (val: number) => (val || 0).toLocaleString('pt-BR');

const dateTime = (ts: unknown) =>
  parseDate(ts)?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '-';

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const setText = (doc: jsPDF, size: number, style: 'normal' | 'bold', color: RGB) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};

/** Corta o texto com reticências para caber na largura. */
const fit = (doc: jsPDF, text: string, maxW: number) => {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return `${t}…`;
};

const newDoc = () => new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
const pageW = (doc: jsPDF) => doc.internal.pageSize.getWidth();
const pageH = (doc: jsPDF) => doc.internal.pageSize.getHeight();

/** Cabeçalho completo da primeira página. Devolve o Y onde o conteúdo começa. */
const drawHeader = (doc: jsPDF, store: StoreInfo, title: string, filterLabel?: string) => {
  const W = pageW(doc);
  const name = store.storeName || 'Munago Mecânica';

  setText(doc, 15, 'bold', C.text);
  doc.text(name, M, 14);
  setText(doc, 9, 'normal', C.muted);
  doc.text(title, M, 19.5);

  setText(doc, 7.5, 'normal', C.muted);
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`, W - M, 11.5, { align: 'right' });
  const contact = [store.contactPhone, store.contactEmail].filter(Boolean).join('  ·  ');
  if (contact) doc.text(fit(doc, contact, 110), W - M, 16, { align: 'right' });
  if (store.address) doc.text(fit(doc, store.address.replace(/\s+/g, ' '), 110), W - M, 20.5, { align: 'right' });

  doc.setDrawColor(...C.blue);
  doc.setLineWidth(0.8);
  doc.line(M, 24, W - M, 24);

  if (filterLabel) {
    setText(doc, 7.5, 'normal', C.muted);
    doc.text(fit(doc, `Filtro: ${filterLabel}`, W - 2 * M), M, 29);
    return 33;
  }
  return 29;
};

/** Cabeçalho reduzido das páginas seguintes. */
const drawCompactHeader = (doc: jsPDF, store: StoreInfo, title: string) => {
  const W = pageW(doc);
  setText(doc, 8.5, 'bold', C.text);
  doc.text(store.storeName || 'Munago Mecânica', M, 10);
  setText(doc, 8, 'normal', C.muted);
  doc.text(title, W - M, 10, { align: 'right' });
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(M, 13, W - M, 13);
};

/** Rodapé com "Página X de Y" em todas as páginas e salva o arquivo. */
const finalize = (doc: jsPDF, store: StoreInfo, label: string, filePrefix: string) => {
  const W = pageW(doc);
  const H = pageH(doc);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    setText(doc, 7, 'normal', C.faint);
    doc.text(`${store.storeName || 'Munago Mecânica'} · ${label}`, M, H - 6);
    doc.text(`Página ${i} de ${total}`, W - M, H - 6, { align: 'right' });
  }
  const slug = (store.storeName || 'munago').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');
  doc.save(`${filePrefix}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/** Estilo de tabela "planilha": linhas finas, cabeçalho cinza, zebra leve. */
const tableBase = (doc: jsPDF, store: StoreInfo, title: string): Partial<UserOptions> => ({
  theme: 'plain',
  styles: {
    font: 'helvetica',
    fontSize: 7.5,
    cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    textColor: C.text,
    lineColor: C.border,
    lineWidth: { bottom: 0.1 },
    overflow: 'ellipsize',
  },
  headStyles: {
    fillColor: C.track,
    textColor: C.muted,
    fontStyle: 'bold',
    fontSize: 7,
    lineColor: [212, 212, 216],
    lineWidth: { bottom: 0.3 },
  },
  footStyles: { fillColor: C.track, textColor: C.text, fontStyle: 'bold', lineWidth: { top: 0.3 }, lineColor: [212, 212, 216] },
  alternateRowStyles: { fillColor: C.bg },
  margin: { left: M, right: M, top: TOP_CONT, bottom: 16 },
  showHead: 'everyPage',
  showFoot: 'lastPage',
  didDrawPage: () => {
    if (doc.getCurrentPageInfo().pageNumber > 1) drawCompactHeader(doc, store, title);
  },
});

/** O autotable não aplica o alinhamento da coluna ao cabeçalho/rodapé; copia aqui. */
const table = (doc: jsPDF, opts: UserOptions) => {
  const own = opts.didParseCell;
  autoTable(doc, {
    ...opts,
    didParseCell: data => {
      if (data.section !== 'body' && !(data.cell.raw && typeof data.cell.raw === 'object' && 'styles' in (data.cell.raw as object))) {
        const col = (opts.columnStyles as Record<number, { halign?: 'left' | 'center' | 'right' }> | undefined)?.[data.column.index];
        if (col?.halign) data.cell.styles.halign = col.halign;
      }
      own?.(data);
    },
  });
};

const lastY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;

/** Título de seção; quebra a página se não couber o título + algumas linhas. */
const sectionTitle = (doc: jsPDF, store: StoreInfo, reportTitle: string, y: number, title: string, subtitle?: string) => {
  if (y > pageH(doc) - 45) {
    doc.addPage();
    drawCompactHeader(doc, store, reportTitle);
    y = TOP_CONT;
  }
  setText(doc, 10.5, 'bold', C.text);
  doc.text(title, M, y + 4);
  if (subtitle) {
    setText(doc, 7.5, 'normal', C.muted);
    doc.text(subtitle, M, y + 8.5);
  }
  return y + (subtitle ? 11 : 7);
};

const card = (
  doc: jsPDF, x: number, y: number, w: number, h: number,
  label: string, value: string, sub?: string, tone: 'default' | 'alert' = 'default', accent: RGB = C.blue,
) => {
  const alert = tone === 'alert';
  doc.setFillColor(...(alert ? C.redBg : ([255, 255, 255] as RGB)));
  doc.setDrawColor(...(alert ? C.redBorder : C.border));
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  doc.setFillColor(...(alert ? C.red : accent));
  doc.rect(x, y + 3, 0.9, h - 6, 'F');

  setText(doc, 6.8, 'bold', alert ? C.red : C.muted);
  doc.text(label.toUpperCase(), x + 4, y + 5.5);
  const big = h >= 18;
  setText(doc, big ? 14 : 10.5, 'bold', alert ? C.red : C.text);
  doc.text(fit(doc, value, w - 8), x + 4, y + (big ? 12.5 : 10.5));
  if (sub && big) {
    setText(doc, 6.8, 'normal', C.muted);
    doc.text(fit(doc, sub, w - 8), x + 4, y + 17.5);
  }
};

/** Moldura de painel com título. Devolve a área interna. */
const panel = (doc: jsPDF, x: number, y: number, w: number, h: number, title: string, subtitle?: string) => {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  setText(doc, 8.5, 'bold', C.text);
  doc.text(title, x + 4, y + 6);
  if (subtitle) {
    setText(doc, 6.8, 'normal', C.muted);
    doc.text(subtitle, x + w - 4, y + 6, { align: 'right' });
  }
  return { x: x + 4, y: y + 10, w: w - 8, h: h - 13 };
};

const emptyNote = (doc: jsPDF, box: { x: number; y: number; w: number; h: number }, text: string) => {
  setText(doc, 7.5, 'normal', C.faint);
  doc.text(text, box.x + box.w / 2, box.y + box.h / 2, { align: 'center' });
};

/** Lista de barras horizontais: rótulo, valor à direita e barra proporcional. */
const hBars = (
  doc: jsPDF,
  box: { x: number; y: number; w: number; h: number },
  rows: { label: string; value: number; valueLabel: string; color?: RGB }[],
  emptyText: string,
) => {
  if (!rows.length || rows.every(r => r.value <= 0)) return emptyNote(doc, box, emptyText);
  const max = Math.max(...rows.map(r => r.value), 1);
  const rowH = Math.min(8, box.h / rows.length);
  rows.forEach((r, i) => {
    const y = box.y + i * rowH;
    setText(doc, 7, 'bold', C.text);
    const valW = doc.getTextWidth(r.valueLabel);
    doc.text(r.valueLabel, box.x + box.w, y + 3, { align: 'right' });
    setText(doc, 7, 'normal', C.text);
    doc.text(fit(doc, r.label, box.w - valW - 4), box.x, y + 3);
    doc.setFillColor(...C.track);
    doc.roundedRect(box.x, y + 4.4, box.w, 1.6, 0.8, 0.8, 'F');
    doc.setFillColor(...(r.color || C.blue));
    doc.roundedRect(box.x, y + 4.4, Math.max(1.6, (r.value / max) * box.w), 1.6, 0.8, 0.8, 'F');
  });
};

// ---------------------------------------------------------------------------
// Tabelas reutilizadas
// ---------------------------------------------------------------------------

const stockStatus = (p: Product) => ((p.quantity || 0) <= 0 ? 'Esgotado' : (p.quantity || 0) <= (p.minQuantity || 0) ? 'Crítico' : 'Normal');

const inventoryTable = (doc: jsPDF, store: StoreInfo, title: string, products: Product[], startY: number) => {
  // Agrupa por categoria: uma linha de título por grupo + itens em ordem alfabética
  const byCat = new Map<string, Product[]>();
  [...products]
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
    .forEach(p => {
      const cat = p.category || 'Geral';
      byCat.set(cat, [...(byCat.get(cat) || []), p]);
    });

  const body: RowInput[] = [];
  let totalQty = 0;
  let totalValue = 0;
  Array.from(byCat.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .forEach(([cat, items]) => {
      const catValue = items.reduce((a, p) => a + (p.price || 0) * (p.quantity || 0), 0);
      body.push([
        { content: `${cat}  ·  ${items.length} ${items.length === 1 ? 'item' : 'itens'}`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: C.blue } },
        { content: brl(catValue), colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [239, 246, 255], textColor: C.blue } },
      ]);
      items.forEach(p => {
        const value = (p.price || 0) * (p.quantity || 0);
        totalQty += p.quantity || 0;
        totalValue += value;
        body.push([p.sku || '-', p.name || 'Sem nome', num(p.quantity), num(p.minQuantity), brl(p.price || 0), brl(value), stockStatus(p), p.supplier || '-']);
      });
    });

  table(doc, {
    ...tableBase(doc, store, title),
    startY,
    head: [['SKU', 'Produto', 'Qtd.', 'Mín.', 'Unitário', 'Valor em estoque', 'Situação', 'Fornecedor']],
    body,
    foot: [[
      { content: `${products.length} produtos`, colSpan: 2 },
      { content: num(totalQty), styles: { halign: 'right' } },
      '',
      '',
      { content: brl(totalValue), styles: { halign: 'right' } },
      { content: '', colSpan: 2 },
    ]],
    columnStyles: {
      0: { cellWidth: 26, textColor: C.muted },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 14, halign: 'right', textColor: C.muted },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 38, textColor: C.muted },
    },
    didParseCell: data => {
      if (data.section !== 'body' || data.column.index !== 6) return;
      const v = String(data.cell.raw);
      if (v === 'Esgotado') { data.cell.styles.textColor = C.red; data.cell.styles.fontStyle = 'bold'; }
      else if (v === 'Crítico') { data.cell.styles.textColor = C.amber; data.cell.styles.fontStyle = 'bold'; }
      else if (v === 'Normal') data.cell.styles.textColor = C.green;
    },
  });
};

const transactionsTable = (doc: jsPDF, store: StoreInfo, title: string, transactions: Transaction[], startY: number) => {
  const sorted = [...transactions].sort((a, b) => (parseDate(b.timestamp)?.getTime() ?? 0) - (parseDate(a.timestamp)?.getTime() ?? 0));

  // Linha de título por dia, como na tela de Movimentações
  const body: RowInput[] = [];
  let currentDay = '';
  let inQty = 0;
  let outQty = 0;
  sorted.forEach(t => {
    const d = parseDate(t.timestamp);
    const day = d ? d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data';
    if (day !== currentDay) {
      currentDay = day;
      const dayRows = sorted.filter(x => {
        const xd = parseDate(x.timestamp);
        return (xd ? xd.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data') === day;
      });
      const dIn = dayRows.filter(x => x.type === 'in').reduce((a, x) => a + (x.quantity || 0), 0);
      const dOut = dayRows.filter(x => x.type === 'out').reduce((a, x) => a + (x.quantity || 0), 0);
      body.push([
        { content: day.charAt(0).toUpperCase() + day.slice(1), colSpan: 3, styles: { fontStyle: 'bold', fillColor: C.track } },
        { content: `+${num(dIn)} / -${num(dOut)}`, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: C.track, textColor: C.muted } },
      ]);
    }
    const isIn = t.type === 'in';
    if (isIn) inQty += t.quantity || 0; else outQty += t.quantity || 0;
    body.push([
      d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
      t.productName || 'Item sem nome',
      isIn ? 'Entrada' : 'Saída',
      `${isIn ? '+' : '-'}${num(t.quantity)}`,
      t.userName || 'Sistema',
      t.reason || '-',
    ]);
  });

  table(doc, {
    ...tableBase(doc, store, title),
    startY,
    head: [['Hora', 'Produto', 'Tipo', 'Qtd.', 'Operador', 'Justificativa']],
    body,
    foot: [[
      { content: `${sorted.length} registros`, colSpan: 3 },
      { content: `+${num(inQty)} / -${num(outQty)}`, styles: { halign: 'right' } },
      { content: `Saldo ${inQty - outQty >= 0 ? '+' : ''}${num(inQty - outQty)}`, colSpan: 2 },
    ]],
    columnStyles: {
      0: { cellWidth: 16, textColor: C.muted },
      1: { cellWidth: 80, fontStyle: 'bold' },
      2: { cellWidth: 20 },
      3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 40 },
      5: { cellWidth: 'auto', textColor: C.muted },
    },
    didParseCell: data => {
      if (data.section !== 'body' || (data.column.index !== 2 && data.column.index !== 3)) return;
      const raw = String(data.cell.raw);
      if (raw === 'Entrada' || raw.startsWith('+')) data.cell.styles.textColor = C.green;
      else if (raw === 'Saída' || raw.startsWith('-')) data.cell.styles.textColor = C.red;
    },
  });
};

// ---------------------------------------------------------------------------
// Relatório de estoque (tela Almoxarifado)
// ---------------------------------------------------------------------------

export interface ExportInventoryPdfOptions {
  storeName?: string;
  store?: StoreInfo;
  products: Product[];
  filterLabel?: string;
}

export const exportInventoryToPDF = ({ storeName, store: storeInfo, products, filterLabel }: ExportInventoryPdfOptions) => {
  const store: StoreInfo = { ...storeInfo, storeName: storeInfo?.storeName || storeName || 'Munago Mecânica' };
  const title = 'Relatório de estoque';
  const doc = newDoc();
  const W = pageW(doc);
  let y = drawHeader(doc, store, title, filterLabel);

  const totalQty = products.reduce((a, p) => a + (p.quantity || 0), 0);
  const totalValue = products.reduce((a, p) => a + (p.price || 0) * (p.quantity || 0), 0);
  const low = products.filter(p => (p.quantity || 0) <= (p.minQuantity || 0));

  const cw = (W - 2 * M - 3 * 4) / 4;
  card(doc, M, y, cw, 21, 'Produtos', num(products.length), `${new Set(products.map(p => p.category || 'Geral')).size} categorias`);
  card(doc, M + (cw + 4), y, cw, 21, 'Unidades em estoque', `${num(totalQty)} un`);
  card(doc, M + 2 * (cw + 4), y, cw, 21, 'Valor em estoque', brl(totalValue), `Média ${brl(products.length ? totalValue / products.length : 0)} por item`);
  card(doc, M + 3 * (cw + 4), y, cw, 21, 'Abaixo do mínimo', `${num(low.length)} itens`, low.length ? 'Precisam de reposição' : 'Nenhuma ruptura', low.length ? 'alert' : 'default');
  y += 26;

  inventoryTable(doc, store, title, products, y);
  finalize(doc, store, title, 'relatorio_estoque');
};

// ---------------------------------------------------------------------------
// Relatório de movimentações (tela Movimentações)
// ---------------------------------------------------------------------------

export interface ExportTransactionsPdfOptions {
  storeName?: string;
  store?: StoreInfo;
  transactions: Transaction[];
  filterLabel?: string;
}

export const exportTransactionsToPDF = ({ storeName, store: storeInfo, transactions, filterLabel }: ExportTransactionsPdfOptions) => {
  const store: StoreInfo = { ...storeInfo, storeName: storeInfo?.storeName || storeName || 'Munago Mecânica' };
  const title = 'Relatório de movimentações';
  const doc = newDoc();
  const W = pageW(doc);
  let y = drawHeader(doc, store, title, filterLabel);

  const ins = transactions.filter(t => t.type === 'in');
  const outs = transactions.filter(t => t.type === 'out');
  const inQty = ins.reduce((a, t) => a + (t.quantity || 0), 0);
  const outQty = outs.reduce((a, t) => a + (t.quantity || 0), 0);
  const dates = transactions.map(t => parseDate(t.timestamp)?.getTime()).filter((v): v is number => !!v);
  const period = dates.length
    ? `${new Date(Math.min(...dates)).toLocaleDateString('pt-BR')} a ${new Date(Math.max(...dates)).toLocaleDateString('pt-BR')}`
    : 'Sem registros';

  const cw = (W - 2 * M - 3 * 4) / 4;
  card(doc, M, y, cw, 21, 'Registros', num(transactions.length), period);
  card(doc, M + (cw + 4), y, cw, 21, 'Entradas', `+${num(inQty)} un`, `${ins.length} movimentações`, 'default', C.green);
  card(doc, M + 2 * (cw + 4), y, cw, 21, 'Saídas', `-${num(outQty)} un`, `${outs.length} movimentações`, 'default', C.red);
  card(doc, M + 3 * (cw + 4), y, cw, 21, 'Saldo', `${inQty - outQty >= 0 ? '+' : ''}${num(inQty - outQty)} un`, 'Entradas menos saídas');
  y += 26;

  transactionsTable(doc, store, title, transactions, y);
  finalize(doc, store, title, 'relatorio_movimentacoes');
};

// ---------------------------------------------------------------------------
// Relatório executivo (Monitoramento): 1ª página = painel, depois o detalhe
// ---------------------------------------------------------------------------

export interface ExportExecutivePdfOptions {
  store: StoreInfo;
  products: Product[];
  transactions: Transaction[];
  serviceOrders: ServiceOrder[];
}

const OS_STEPS: { value: ServiceOrder['status']; label: string; color: RGB }[] = [
  { value: 'draft', label: 'Orçamento', color: [161, 161, 170] },
  { value: 'in_progress', label: 'Em manutenção', color: C.amber },
  { value: 'completed', label: 'Aguardando retirada', color: C.blue },
  { value: 'paid', label: 'Pago', color: C.green },
];

export const exportExecutiveReportToPDF = ({ store, products, transactions, serviceOrders }: ExportExecutivePdfOptions) => {
  const title = 'Relatório executivo';
  const doc = newDoc();
  const W = pageW(doc);
  const inner = W - 2 * M;

  // ----- Números -----
  const start30 = startOfDayAgo(29);
  const start60 = startOfDayAgo(59);

  const totalUnits = products.reduce((a, p) => a + (p.quantity || 0), 0);
  const stockValue = products.reduce((a, p) => a + (p.price || 0) * (p.quantity || 0), 0);
  const low = products
    .filter(p => (p.quantity || 0) <= (p.minQuantity || 0))
    .sort((a, b) => ((b.minQuantity || 0) - (b.quantity || 0)) - ((a.minQuantity || 0) - (a.quantity || 0)));
  const healthy = products.length ? Math.round(((products.length - low.length) / products.length) * 100) : 100;

  const revenueDaily = Array(30).fill(0) as number[];
  let revenue = 0;
  let revenuePrev = 0;
  let billedCount = 0;
  serviceOrders.filter(isBilledOS).forEach(os => {
    const d = osBilledDate(os);
    if (!d) return;
    if (d >= start30) {
      const idx = Math.floor((d.getTime() - start30.getTime()) / DAY_MS);
      if (idx >= 0 && idx < 30) revenueDaily[idx] += osAmount(os);
      revenue += osAmount(os);
      billedCount += 1;
    } else if (d >= start60) {
      revenuePrev += osAmount(os);
    }
  });
  const revenueDelta = revenuePrev > 0 ? Math.round(((revenue - revenuePrev) / revenuePrev) * 100) : null;

  const osByStatus = OS_STEPS.map(s => {
    const list = serviceOrders.filter(os => os.status === s.value);
    return { ...s, count: list.length, amount: list.reduce((a, os) => a + osAmount(os), 0) };
  });
  const openOS = serviceOrders.filter(os => os.status === 'draft' || os.status === 'in_progress');
  const openValue = openOS.reduce((a, os) => a + osAmount(os), 0);

  const tx30 = transactions.filter(t => { const d = parseDate(t.timestamp); return d && d >= start30; });
  const in30 = tx30.filter(t => t.type === 'in').reduce((a, t) => a + (t.quantity || 0), 0);
  const out30 = tx30.filter(t => t.type === 'out').reduce((a, t) => a + (t.quantity || 0), 0);

  const consumed = new Map<string, { name: string; qty: number }>();
  tx30.filter(t => t.type === 'out').forEach(t => {
    const e = consumed.get(t.productId) || { name: t.productName, qty: 0 };
    e.qty += t.quantity || 0;
    consumed.set(t.productId, e);
  });
  const topConsumed = Array.from(consumed.values()).sort((a, b) => b.qty - a.qty).slice(0, 6);

  const catMap = new Map<string, number>();
  products.forEach(p => catMap.set(p.category || 'Geral', (catMap.get(p.category || 'Geral') || 0) + (p.price || 0) * (p.quantity || 0)));
  const cats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
  const catRows = cats.slice(0, 5).map(([name, value], i) => ({ name, value, color: hexToRgb(SERIES_LIGHT[i]) }));
  if (cats.length > 5) catRows.push({ name: `Outras (${cats.length - 5})`, value: cats.slice(5).reduce((a, c) => a + c[1], 0), color: C.faint });

  const coverage = products
    .map(p => {
      const out = consumed.get(p.id)?.qty || 0;
      if (out <= 0) return null;
      const days = (p.quantity || 0) / (out / 30);
      return { name: p.name, days, qty: p.quantity || 0 };
    })
    .filter((r): r is { name: string; days: number; qty: number } => !!r)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  // ----- Página 1: painel -----
  let y = drawHeader(doc, store, `${title} · últimos 30 dias`);

  const cw = (inner - 3 * 4) / 4;
  card(doc, M, y, cw, 21, 'Patrimônio em estoque', brl(stockValue), `${num(products.length)} produtos · ${num(totalUnits)} un`);
  card(
    doc, M + (cw + 4), y, cw, 21, 'Faturamento 30 dias', brl(revenue),
    `${billedCount} OS · ticket ${brl(billedCount ? revenue / billedCount : 0)}${revenueDelta !== null ? ` · ${revenueDelta >= 0 ? '+' : ''}${revenueDelta}% vs. 30 dias antes` : ''}`,
    'default', C.green,
  );
  card(doc, M + 2 * (cw + 4), y, cw, 21, 'Disponibilidade', `${healthy}%`, `${num(products.length - low.length)} de ${num(products.length)} itens acima do mínimo`);
  card(doc, M + 3 * (cw + 4), y, cw, 21, 'Risco de ruptura', `${num(low.length)} itens`, low.length ? 'Abaixo do estoque mínimo' : 'Nenhum item abaixo do mínimo', low.length ? 'alert' : 'default');
  y += 24;

  const balance = in30 - out30;
  card(doc, M, y, cw, 14, `OS em aberto · ${openOS.length}`, brl(openValue));
  card(doc, M + (cw + 4), y, cw, 14, 'Entradas 30 dias', `+${num(in30)} un`, undefined, 'default', C.green);
  card(doc, M + 2 * (cw + 4), y, cw, 14, 'Saídas 30 dias', `-${num(out30)} un`, undefined, 'default', C.red);
  card(doc, M + 3 * (cw + 4), y, cw, 14, 'Saldo 30 dias', `${balance >= 0 ? '+' : ''}${num(balance)} un`);
  y += 18;

  // Faturamento diário (colunas) + pipeline de OS
  const leftW = inner * 0.6 - 2;
  const rightW = inner - leftW - 4;
  const rowAH = 54;
  {
    const box = panel(doc, M, y, leftW, rowAH, 'Faturamento de OS por dia', `Total ${brl(revenue)}`);
    const max = Math.max(...revenueDaily);
    if (max <= 0) {
      emptyNote(doc, box, 'Nenhuma OS concluída nos últimos 30 dias.');
    } else {
      const chartH = box.h - 6;
      const base = box.y + chartH;
      const slot = box.w / 30;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      [0.5, 1].forEach(f => doc.line(box.x, base - chartH * f, box.x + box.w, base - chartH * f));
      setText(doc, 6, 'normal', C.faint);
      doc.text(brlShort(max), box.x, base - chartH + 2.5);
      revenueDaily.forEach((v, i) => {
        if (v <= 0) return;
        const h = Math.max(0.6, (v / max) * (chartH - 4));
        doc.setFillColor(...C.blue);
        doc.rect(box.x + i * slot + slot * 0.18, base - h, slot * 0.64, h, 'F');
      });
      doc.setDrawColor(...C.faint);
      doc.line(box.x, base, box.x + box.w, base);
      setText(doc, 6, 'normal', C.muted);
      [0, 7, 14, 21, 29].forEach(i => {
        const d = startOfDayAgo(29 - i);
        doc.text(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), box.x + i * slot + slot / 2, base + 4, { align: 'center' });
      });
    }
  }
  {
    const box = panel(doc, M + leftW + 4, y, rightW, rowAH, 'Ordens de serviço por etapa', `${num(serviceOrders.length)} no total`);
    hBars(
      doc, box,
      osByStatus.map(s => ({ label: `${s.label} · ${s.count}`, value: s.count, valueLabel: brl(s.amount), color: s.color })),
      'Nenhuma ordem de serviço cadastrada.',
    );
  }
  y += rowAH + 4;

  // Peças mais consumidas, valor por categoria, cobertura
  const rowBH = pageH(doc) - 14 - y;
  const tw = (inner - 2 * 4) / 3;
  {
    const box = panel(doc, M, y, tw, rowBH, 'Peças mais consumidas', 'Saídas em 30 dias');
    hBars(doc, box, topConsumed.map(r => ({ label: r.name, value: r.qty, valueLabel: `${num(r.qty)} un` })), 'Nenhuma saída nos últimos 30 dias.');
  }
  {
    const box = panel(doc, M + tw + 4, y, tw, rowBH, 'Valor parado por categoria', brl(stockValue));
    hBars(
      doc, box,
      catRows.map(r => ({ label: r.name, value: r.value, valueLabel: `${brlShort(r.value)} · ${stockValue ? Math.round((r.value / stockValue) * 100) : 0}%`, color: r.color })),
      'Cadastre preços para ver a distribuição.',
    );
  }
  {
    const box = panel(doc, M + 2 * (tw + 4), y, tw, rowBH, 'Cobertura de estoque', 'Dias até acabar');
    hBars(
      doc, box,
      coverage.map(r => ({
        label: r.name,
        // barra maior = mais perto de acabar
        value: Math.max(0.5, 30 - Math.min(30, r.days)),
        valueLabel: r.qty === 0 ? 'Zerado' : r.days < 1 ? '< 1 dia' : `${Math.floor(r.days)} dias`,
        color: r.days <= 7 ? C.red : r.days <= 15 ? C.amber : C.green,
      })),
      'Sem consumo recente para calcular.',
    );
  }

  // ----- Página 2 em diante: detalhe -----
  doc.addPage();
  drawCompactHeader(doc, store, title);
  y = TOP_CONT;

  if (low.length) {
    y = sectionTitle(doc, store, title, y, 'Itens abaixo do mínimo', `${low.length} itens · custo estimado para repor até o mínimo`);
    const replenish = low.reduce((a, p) => a + Math.max(0, (p.minQuantity || 0) - (p.quantity || 0)) * (p.price || 0), 0);
    table(doc, {
      ...tableBase(doc, store, title),
      startY: y,
      head: [['SKU', 'Produto', 'Categoria', 'Qtd.', 'Mín.', 'Repor', 'Unitário', 'Custo da reposição']],
      body: low.map(p => {
        const deficit = Math.max(0, (p.minQuantity || 0) - (p.quantity || 0));
        return [p.sku || '-', p.name, p.category || 'Geral', num(p.quantity), num(p.minQuantity), num(deficit), brl(p.price || 0), brl(deficit * (p.price || 0))] as CellInput[];
      }),
      foot: [[{ content: 'Total para repor', colSpan: 7 }, { content: brl(replenish), styles: { halign: 'right' } }]],
      columnStyles: {
        0: { cellWidth: 26, textColor: C.muted },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 36 },
        3: { cellWidth: 14, halign: 'right', textColor: C.red, fontStyle: 'bold' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 26, halign: 'right' },
        7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
    });
    y = lastY(doc) + 8;
  }

  if (openOS.length) {
    y = sectionTitle(doc, store, title, y, 'Ordens de serviço em aberto', `${openOS.length} OS · ${brl(openValue)}`);
    table(doc, {
      ...tableBase(doc, store, title),
      startY: y,
      head: [['OS', 'Cliente', 'Veículo', 'Placa', 'Etapa', 'Entrada', 'Itens', 'Total']],
      body: [...openOS]
        .sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''))
        .map(os => [
          `#${os.id.slice(-6).toUpperCase()}`,
          os.customerName || '-',
          os.vehicleModel || '-',
          os.vehiclePlate || '-',
          OS_STEPS.find(s => s.value === os.status)?.label || os.status,
          dateTime(os.scheduledDate),
          String(os.items?.length || 0),
          brl(osAmount(os)),
        ]),
      columnStyles: {
        0: { cellWidth: 20, textColor: C.muted },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 46 },
        3: { cellWidth: 22 },
        4: { cellWidth: 32 },
        5: { cellWidth: 32 },
        6: { cellWidth: 14, halign: 'right' },
        7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
    });
    y = lastY(doc) + 8;
  }

  y = sectionTitle(doc, store, title, y, 'Inventário completo', `${num(products.length)} produtos · ${brl(stockValue)}`);
  inventoryTable(doc, store, title, products, y);
  y = lastY(doc) + 8;

  if (tx30.length) {
    y = sectionTitle(doc, store, title, y, 'Movimentações dos últimos 30 dias', `+${num(in30)} / -${num(out30)} un`);
    transactionsTable(doc, store, title, tx30, y);
  }

  finalize(doc, store, title, 'relatorio_executivo');
};
