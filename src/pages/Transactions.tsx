import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  ArrowDownLeft, 
  ArrowUpRight,
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  Package
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { exportTransactionsToPDF } from '../lib/pdfExport';

export const Transactions = () => {
  const { transactions, settings } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      const matchesSearch = 
        (t.productName && t.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.userName && t.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.reason && t.reason.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === 'all' || t.type === typeFilter;

      return matchesSearch && matchesType;
    }).sort((a, b) => {
      const timeA = typeof a.timestamp?.toMillis === 'function' ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
      const timeB = typeof b.timestamp?.toMillis === 'function' ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [transactions, searchTerm, typeFilter]);

  const stats = useMemo(() => {
    const inList = (transactions || []).filter(t => t.type === 'in');
    const outList = (transactions || []).filter(t => t.type === 'out');
    const inQty = inList.reduce((acc, t) => acc + (t.quantity || 0), 0);
    const outQty = outList.reduce((acc, t) => acc + (t.quantity || 0), 0);

    return {
      total: (transactions || []).length,
      inCount: inList.length,
      outCount: outList.length,
      inQty,
      outQty,
      balance: inQty - outQty
    };
  }, [transactions]);

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
        'Data / Hora': t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString('pt-BR') : 'Data não registrada',
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

  return (
    <div className="space-y-8 pb-32">
      {/* Header and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white tracking-widest uppercase">
            Histórico Logístico
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-1">
            Auditagem completa e rastreabilidade de todas as entradas e saídas.
          </p>
        </div>

        {/* Export Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
            title="Exportar Relatório de Auditoria em formato PDF"
          >
            <FileText size={18} />
            Relatório PDF
          </button>

          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-5 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95 shadow-sm cursor-pointer"
            title="Exportar dados para planilha Excel (.xlsx)"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Operações</span>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1 tabular-nums">
            {stats.total}
          </p>
          <span className="text-[10px] font-bold text-zinc-400 mt-2">Registros auditados</span>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Entradas (+)</span>
            <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            +{stats.inQty.toLocaleString('pt-BR')} <span className="text-xs font-bold text-zinc-400">un.</span>
          </p>
          <span className="text-[10px] font-bold text-zinc-400 mt-2">{stats.inCount} movimentações</span>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 dark:text-rose-400">Saídas (-)</span>
            <ArrowUpRight size={16} className="text-red-500 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-black text-red-500 dark:text-rose-400 mt-1 tabular-nums">
            -{stats.outQty.toLocaleString('pt-BR')} <span className="text-xs font-bold text-zinc-400">un.</span>
          </p>
          <span className="text-[10px] font-bold text-zinc-400 mt-2">{stats.outCount} movimentações</span>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Saldo Líquido</span>
          <p className={`text-2xl font-black mt-1 tabular-nums ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
            {stats.balance >= 0 ? '+' : ''}{stats.balance.toLocaleString('pt-BR')} <span className="text-xs font-bold text-zinc-400">un.</span>
          </p>
          <span className="text-[10px] font-bold text-zinc-400 mt-2">Fluxo de volume</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Filtrar por produto, operador ou motivo..." 
            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl font-bold text-xs outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 sm:flex-initial px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              typeFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Todos ({transactions.length})
          </button>
          <button
            onClick={() => setTypeFilter('in')}
            className={`flex-1 sm:flex-initial px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              typeFilter === 'in'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border border-zinc-100 dark:border-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
            }`}
          >
            Entradas
          </button>
          <button
            onClick={() => setTypeFilter('out')}
            className={`flex-1 sm:flex-initial px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              typeFilter === 'out'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-red-500 dark:text-rose-400 border border-zinc-100 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/20'
            }`}
          >
            Saídas
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-100 dark:border-zinc-700">
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Temporal</th>
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Produto / Item</th>
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-center">Tipo de Fluxo</th>
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-center">Quantidade</th>
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Operador</th>
                <th className="px-8 py-5 text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Justificativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredTransactions.map((t, i) => (
                <motion.tr 
                  key={t.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group"
                >
                  <td className="px-8 py-5 text-xs font-black text-zinc-600 dark:text-zinc-400 tabular-nums uppercase">
                    {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString('pt-BR') : 'Recente'}
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                      {t.productName}
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${
                        t.type === 'in' 
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
                          : 'text-red-500 dark:text-rose-400 bg-red-50 dark:bg-rose-900/20 shadow-inner shadow-red-500/5'
                      }`}>
                        {t.type === 'in' ? <ArrowDownLeft size={12} strokeWidth={3} /> : <ArrowUpRight size={12} strokeWidth={3} />}
                        {t.type === 'in' ? 'Entrada' : 'Saída'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <p className={`text-lg font-black tracking-tighter tabular-nums ${t.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {t.type === 'in' ? '+' : '-'}{t.quantity}
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                        {t.userName?.charAt(0) || 'S'}
                      </div>
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate max-w-[140px]">
                        {t.userName || 'Sistema'}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 italic font-medium leading-relaxed">
                      {t.reason || 'S/ justificativa'}
                    </p>
                  </td>
                </motion.tr>
              ))}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-zinc-400 italic font-black text-xs uppercase tracking-widest opacity-60">
                    Nenhuma movimentação encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredTransactions.map(t => (
            <div key={t.id} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl ${
                  t.type === 'in' 
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
                    : 'text-red-500 dark:text-rose-400 bg-red-50 dark:bg-rose-900/20'
                }`}>
                  {t.type === 'in' ? <ArrowDownLeft size={12} strokeWidth={3} /> : <ArrowUpRight size={12} strokeWidth={3} />}
                  {t.type === 'in' ? 'Entrada' : 'Saída'}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">
                  {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString('pt-BR') : 'Agora'}
                </span>
              </div>
              <div>
                <p className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-2">
                  {t.productName}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Quantidade: <span className={`font-black text-lg ml-1 ${t.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'in' ? '+' : '-'}{t.quantity}
                    </span>
                  </p>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate max-w-[150px]">
                    {t.userName}
                  </p>
                </div>
              </div>
              {t.reason && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/80 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                  {t.reason}
                </p>
              )}
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="p-16 text-center text-zinc-400 italic uppercase font-black text-xs tracking-widest opacity-40">
              Nenhuma movimentação encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
