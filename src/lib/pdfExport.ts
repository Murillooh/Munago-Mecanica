import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Transaction } from '../context/AppContext';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatDateTime = (timestamp: any) => {
  if (!timestamp) return '-';
  try {
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(timestamp);
  }
};

export interface ExportInventoryPdfOptions {
  storeName?: string;
  products: Product[];
  filterLabel?: string;
}

export interface ExportTransactionsPdfOptions {
  storeName?: string;
  transactions: Transaction[];
  filterLabel?: string;
}

/**
 * Export Inventory / Stock to PDF
 */
export const exportInventoryToPDF = ({
  storeName = 'Munago Estoque',
  products,
  filterLabel
}: ExportInventoryPdfOptions) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentDate = new Date().toLocaleString('pt-BR');

  // Metrics calculation
  const totalProducts = products.length;
  const totalQuantity = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalInventoryValue = products.reduce((acc, p) => acc + ((p.price || 0) * (p.quantity || 0)), 0);
  const lowStockCount = products.filter(p => (p.quantity || 0) <= (p.minQuantity || 0)).length;

  // Header Banner
  doc.setFillColor(37, 99, 235); // Blue 600
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Header Title & Store Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('RELATÓRIO GERAL DE ESTOQUE & INVENTÁRIO', 14, 18);

  doc.setFontSize(8.5);
  doc.text(`Emissão: ${currentDate}`, pageWidth - 14, 12, { align: 'right' });
  if (filterLabel) {
    doc.text(`Filtro: ${filterLabel}`, pageWidth - 14, 18, { align: 'right' });
  }

  // KPI Summary Cards
  const kpis = [
    { title: 'PRODUTOS CADASTRADOS', value: `${totalProducts} itens` },
    { title: 'UNIDADES EM ESTOQUE', value: `${totalQuantity.toLocaleString('pt-BR')} un.` },
    { title: 'VALOR TOTAL EM ESTOQUE', value: formatCurrency(totalInventoryValue) },
    { title: 'ESTOQUE BAIXO / CRÍTICO', value: `${lowStockCount} itens`, isAlert: lowStockCount > 0 }
  ];

  const cardY = 28;
  const cardHeight = 16;
  const gap = 4;
  const availableWidth = pageWidth - 28;
  const cardWidth = (availableWidth - (gap * (kpis.length - 1))) / kpis.length;

  kpis.forEach((kpi, index) => {
    const cardX = 14 + (index * (cardWidth + gap));
    
    // Background
    if (kpi.isAlert) {
      doc.setFillColor(254, 242, 242); // Light red
      doc.setDrawColor(252, 165, 165);
    } else {
      doc.setFillColor(248, 250, 252); // Light slate
      doc.setDrawColor(226, 232, 240);
    }
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(kpi.isAlert ? 220 : 100, kpi.isAlert ? 38 : 116, kpi.isAlert ? 38 : 139);
    doc.text(kpi.title, cardX + 4, cardY + 5.5);

    // Value
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.isAlert ? 185 : 15, kpi.isAlert ? 28 : 23, kpi.isAlert ? 28 : 42);
    doc.text(kpi.value, cardX + 4, cardY + 12);
  });

  // Table Data
  const tableData = products.map((p, idx) => {
    const isLow = (p.quantity || 0) <= (p.minQuantity || 0);
    const isZero = (p.quantity || 0) <= 0;
    const status = isZero ? 'ESGOTADO' : isLow ? 'CRÍTICO' : 'NORMAL';
    const totalVal = (p.price || 0) * (p.quantity || 0);

    return [
      String(idx + 1).padStart(2, '0'),
      p.sku || '-',
      p.name || 'Sem nome',
      p.category || 'Geral',
      p.quantity?.toLocaleString('pt-BR') ?? '0',
      p.minQuantity?.toLocaleString('pt-BR') ?? '0',
      formatCurrency(p.price || 0),
      formatCurrency(totalVal),
      status
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [[
      '#',
      'SKU',
      'NOME DO PRODUTO',
      'CATEGORIA',
      'QTD',
      'MÍN',
      'UNITÁRIO',
      'TOTAL',
      'STATUS'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'bold' },
      3: { cellWidth: 32 },
      4: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 26 },
      7: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      8: { halign: 'center', cellWidth: 22 }
    },
    didParseCell: (data) => {
      // Highlight low stock or zero stock status cells
      if (data.section === 'body' && data.column.index === 8) {
        const text = String(data.cell.raw);
        if (text === 'ESGOTADO') {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        } else if (text === 'CRÍTICO') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
    didDrawPage: (data) => {
      // Footer
      const str = `Página ${data.pageNumber}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);

      doc.text(
        `${storeName} • Relatório de Estoque emitido para controle gerencial`,
        14,
        pageHeight - 8
      );
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
    margin: { left: 14, right: 14, bottom: 14 }
  });

  const cleanStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `relatorio_estoque_${cleanStoreName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};

/**
 * Export Logistical Transactions / Movements to PDF
 */
export const exportTransactionsToPDF = ({
  storeName = 'Munago Estoque',
  transactions,
  filterLabel
}: ExportTransactionsPdfOptions) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const currentDate = new Date().toLocaleString('pt-BR');

  // Metrics calculation
  const totalRecords = transactions.length;
  const inTransactions = transactions.filter(t => t.type === 'in');
  const outTransactions = transactions.filter(t => t.type === 'out');
  const totalInQty = inTransactions.reduce((acc, t) => acc + (t.quantity || 0), 0);
  const totalOutQty = outTransactions.reduce((acc, t) => acc + (t.quantity || 0), 0);
  const netBalance = totalInQty - totalOutQty;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Header Title & Store Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName.toUpperCase(), 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('AUDITORIA DE MOVIMENTAÇÕES LOGÍSTICAS (ENTRADAS E SAÍDAS)', 14, 18);

  doc.setFontSize(8.5);
  doc.text(`Emissão: ${currentDate}`, pageWidth - 14, 12, { align: 'right' });
  if (filterLabel) {
    doc.text(`Filtro: ${filterLabel}`, pageWidth - 14, 18, { align: 'right' });
  }

  // KPI Summary Cards
  const kpis = [
    { title: 'TOTAL DE TRANSAÇÕES', value: `${totalRecords} registros` },
    { title: 'ENTRADAS (+)', value: `${inTransactions.length} movs (+${totalInQty.toLocaleString('pt-BR')} un.)`, color: [16, 185, 129] },
    { title: 'SAÍDAS (-)', value: `${outTransactions.length} movs (-${totalOutQty.toLocaleString('pt-BR')} un.)`, color: [239, 68, 68] },
    { title: 'BALANÇO LÍQUIDO', value: `${netBalance >= 0 ? '+' : ''}${netBalance.toLocaleString('pt-BR')} un.`, color: netBalance >= 0 ? [37, 99, 235] : [239, 68, 68] }
  ];

  const cardY = 28;
  const cardHeight = 16;
  const gap = 4;
  const availableWidth = pageWidth - 28;
  const cardWidth = (availableWidth - (gap * (kpis.length - 1))) / kpis.length;

  kpis.forEach((kpi, index) => {
    const cardX = 14 + (index * (cardWidth + gap));
    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, cardX + 4, cardY + 5.5);

    // Value
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    if (kpi.color) {
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(kpi.value, cardX + 4, cardY + 12);
  });

  // Table Data
  const sortedTransactions = [...transactions].sort((a, b) => {
    const timeA = typeof a.timestamp?.toMillis === 'function' ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
    const timeB = typeof b.timestamp?.toMillis === 'function' ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const tableData = sortedTransactions.map((t, idx) => {
    const isEntry = t.type === 'in';
    const typeLabel = isEntry ? 'ENTRADA' : 'SAÍDA';
    const qtyLabel = `${isEntry ? '+' : '-'}${t.quantity?.toLocaleString('pt-BR') || 0}`;

    return [
      String(idx + 1).padStart(2, '0'),
      formatDateTime(t.timestamp),
      t.productName || 'Item sem nome',
      typeLabel,
      qtyLabel,
      t.userName || 'Sistema',
      t.reason || 'Sem justificativa registrada'
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [[
      '#',
      'DATA / HORA',
      'PRODUTO / ITEM',
      'TIPO DE FLUXO',
      'QUANTIDADE',
      'OPERADOR',
      'JUSTIFICATIVA'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { cellWidth: 60, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      5: { cellWidth: 35 },
      6: { cellWidth: 'auto' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 3) {
          const type = String(data.cell.raw);
          if (type === 'ENTRADA') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 4) {
          const val = String(data.cell.raw);
          if (val.startsWith('+')) {
            data.cell.styles.textColor = [16, 185, 129];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Footer
      const str = `Página ${data.pageNumber}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);

      doc.text(
        `${storeName} • Histórico Logístico de Movimentações para auditoria`,
        14,
        pageHeight - 8
      );
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
    margin: { left: 14, right: 14, bottom: 14 }
  });

  const cleanStoreName = storeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `relatorio_movimentacoes_${cleanStoreName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
