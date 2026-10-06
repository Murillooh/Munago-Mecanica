import React, { useState, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  FileSpreadsheet,
  Search,
  History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useApp, type Transaction } from '../context/AppContext';
import { exportTransactionsToPDF } from '../lib/pdfExport';
import { parseDate } from '../components/dashboard/utils';

const timeOf = (t: Transaction) => parseDate(t.timestamp)?.getTime() ?? 0;

const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtQty = (n: number) => n.toLocaleString('pt-BR');

// Células no estilo planilha: linhas de grade finas e altura baixa
const th = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-r last:border-r-0 border-zinc-200 dark:border-zinc-800 whitespace-nowrap';
const td = 'px-3 py-1.5 border-b border-r last:border-r-0 border-zinc-100 dark:border-zinc-800/70';

export const Transactions = () => {
  const { transactions, settings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (transactions || []).filter(t => {
      const matchesSearch = !q ||
        t.productName?.toLowerCase().includes(q) ||
        t.userName?.toLowerCase().includes(q) ||
        t.reason?.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      return matchesSearch && matchesType;
    }).sort((a, b) => timeOf(b) - timeOf(a));
  }, [transactions, searchTerm, typeFilter]);

  // Agrupa por dia, mantendo a ordem (mais recente primeiro)
  const groups = useMemo(() => {
    const list: { key: string; label: string; rows: Transaction[]; inQty: number; outQty: number }[] = [];
    filteredTransactions.forEach(t => {
      const d = parseDate(t.timestamp);
      const key = d ? d.toDateString() : 'sem-data';
      let g = list[list.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: d ? dayLabel(d) : 'Sem data', rows: [], inQty: 0, outQty: 0 };
        list.push(g);
      }
      g.rows.push(t);
      if (t.type === 'in') g.inQty += t.quantity || 0;
      else g.outQty += t.quantity || 0;
    });
    return list;
  }, [filteredTransactions]);

  const stats = useMemo(() => {
    let inQty = 0, outQty = 0, inCount = 0, outCount = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'in') { inQty += t.quantity || 0; inCount += 1; }
      else { outQty += t.quantity || 0; outCount += 1; }
    });
    return { total: filteredTransactions.length, inQty, outQty, inCount, outCount, balance: inQty - outQty };
  }, [filteredTransactions]);

  const counts = useMemo(() => ({
    all: (transactions || []).length,
    in: (transactions || []).filter(t => t.type === 'in').length,
    out: (transactions || []).filter(t => t.type === 'out').length,
  }), [transactions]);

  const handleExportPDF = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error('Nenhuma movimentação para exportar.');
      return;
    }

    try {
      const filterLabel = [
        typeFilter === 'in' ? 'Apenas Entradas' : typeFilter === 'out' ? 'Apenas Saídas' : 'Todas as Movimentações',
        searchTerm ? `Busca: "${searchTerm}"` : null
      ].filter(Boolean).join(' | ');

      exportTransactionsToPDF({
        storeName: settings?.storeName || 'Munago Estoque',
        transactions: filteredTransactions,
        filterLabel
      });
      toast.success('Relatório de movimentações em PDF gerado com sucesso!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar relatório em PDF.');
    }
  };

  const handleExportExcel = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error('Nenhuma movimentação para exportar.');
      return;
    }

    try {
      const data = filteredTransactions.map(t => ({
        'Data / Hora': parseDate(t.timestamp)?.toLocaleString('pt-BR') ?? 'Data não registrada',
        'Produto': t.productName || '',
        'Tipo': t.type === 'in' ? 'Entrada (+)' : 'Saída (-)',
        'Quantidade': t.quantity || 0,
        'Operador': t.userName || 'Sistema',
        'Justificativa': t.reason || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
      const filename = `movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Exportação Excel concluída com sucesso!');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Erro ao exportar Excel.');
    }
  };

  const filterButtons = [
    { value: 'all' as const, label: 'Todas', count: counts.all },
    { value: 'in' as const, label: 'Entradas', count: counts.in },
    { value: 'out' as const, label: 'Saídas', count: counts.out },
  ];

  return (
    // No desktop a página ocupa exatamente a altura da tela (descontando o py-6 do <main>) e só a planilha rola.
    <div className="w-full flex flex-col gap-5 lg:h-[calc(100dvh-3rem)]">
      {/* Cabeçalho */}
      <div className="shrink-0 flex items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Movimentações</h1>
          <p className="hidden md:block truncate text-sm text-zinc-500 dark:text-zinc-400">Todas as entradas e saídas do estoque, por dia.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Exportar a lista filtrada para Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Exportar a lista filtrada em PDF"
          >
            <FileText size={15} className="text-rose-600" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      {/* Planilha */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        {/* Barra de ferramentas + resumo do que está filtrado */}
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-center gap-3 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
          <div className="relative lg:w-80">
            <label htmlFor="tx-search" className="sr-only">Filtrar movimentações</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={15} aria-hidden="true" />
            <input
              id="tx-search"
              type="search"
              placeholder="Produto, operador ou motivo"
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 w-fit" role="group" aria-label="Tipo de movimentação">
            {filterButtons.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                aria-pressed={typeFilter === f.value}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === f.value
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {f.label}
                <span className="tabular-nums text-[10px] font-bold text-zinc-400">{f.count}</span>
              </button>
            ))}
          </div>

          <dl className="flex items-center gap-4 lg:ml-auto text-xs tabular-nums">
            <div className="flex items-center gap-1.5">
              <dt className="text-zinc-500">Registros</dt>
              <dd className="font-semibold text-zinc-900 dark:text-white">{fmtQty(stats.total)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-zinc-500">Entradas</dt>
              <dd className="font-semibold text-emerald-600 dark:text-emerald-400">+{fmtQty(stats.inQty)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-zinc-500">Saídas</dt>
              <dd className="font-semibold text-red-600 dark:text-red-400">-{fmtQty(stats.outQty)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-zinc-500">Saldo</dt>
              <dd className={`font-semibold ${stats.balance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                {stats.balance >= 0 ? '+' : ''}{fmtQty(stats.balance)}
              </dd>
            </div>
          </dl>
        </div>

        {filteredTransactions.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-auto max-h-[70dvh] lg:max-h-none">
            <table className="w-full min-w-[760px] text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                <tr className="text-left">
                  <th scope="col" className={`${th} w-12 text-right`}>#</th>
                  <th scope="col" className={`${th} w-16`}>Hora</th>
                  <th scope="col" className={th}>Produto</th>
                  <th scope="col" className={`${th} w-24`}>Tipo</th>
                  <th scope="col" className={`${th} w-20 text-right`}>Qtd.</th>
                  <th scope="col" className={`${th} w-40`}>Operador</th>
                  <th scope="col" className={th}>Justificativa</th>
                </tr>
              </thead>
              {(() => {
                let rowNumber = 0;
                return groups.map(g => (
                  <tbody key={g.key}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={7}
                        className="sticky top-[33px] z-[5] px-3 py-1.5 text-left bg-zinc-100/95 dark:bg-zinc-800/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 capitalize">{g.label}</span>
                          <span className="flex items-center gap-3 text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                            <span>{g.rows.length} {g.rows.length === 1 ? 'registro' : 'registros'}</span>
                            {g.inQty > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{fmtQty(g.inQty)} un</span>}
                            {g.outQty > 0 && <span className="text-red-600 dark:text-red-400">-{fmtQty(g.outQty)} un</span>}
                          </span>
                        </div>
                      </th>
                    </tr>
                    {g.rows.map(t => {
                      rowNumber += 1;
                      const d = parseDate(t.timestamp);
                      const isIn = t.type === 'in';
                      return (
                        <tr key={t.id} className="even:bg-zinc-50/60 dark:even:bg-zinc-800/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors">
                          <td className={`${td} text-right font-mono text-[10px] text-zinc-400 tabular-nums`}>{rowNumber}</td>
                          <td className={`${td} font-mono text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap`}>
                            {d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td className={`${td} font-medium text-zinc-900 dark:text-white max-w-[280px] truncate`} title={t.productName}>
                            {t.productName || 'Item sem nome'}
                          </td>
                          <td className={`${td} whitespace-nowrap`}>
                            <span className={`inline-flex items-center gap-1 font-semibold ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isIn ? <ArrowDownLeft size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}
                              {isIn ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className={`${td} text-right font-mono font-semibold tabular-nums ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isIn ? '+' : '-'}{fmtQty(t.quantity || 0)}
                          </td>
                          <td className={`${td} text-zinc-600 dark:text-zinc-400 max-w-[160px] truncate`} title={t.userName}>
                            {t.userName || 'Sistema'}
                          </td>
                          <td className={`${td} text-zinc-500 dark:text-zinc-400 max-w-[320px] truncate`} title={t.reason}>
                            {t.reason || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ));
              })()}
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <History size={22} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
              {(transactions || []).length === 0 ? 'Nenhuma movimentação registrada' : 'Nada encontrado'}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {(transactions || []).length === 0 ? 'As entradas e saídas do estoque aparecem aqui.' : 'Mude a busca ou o filtro de tipo.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
