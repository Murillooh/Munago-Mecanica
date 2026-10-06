import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Line, 
  ComposedChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity, 
  BarChart3, 
  LineChart as LineChartIcon, 
  Layers, 
  ChevronRight,
  Calendar,
  Zap
} from 'lucide-react';
import { Transaction } from '../../context/AppContext';

interface ProductMovementTrendChartProps {
  transactions: Transaction[];
  onSeeAllHistory?: () => void;
  defaultDays?: 7 | 14 | 30;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const entradas = data?.entradas ?? 0;
    const saidas = data?.saidas ?? 0;
    const saldo = data?.saldo ?? (entradas - saidas);

    return (
      <div className="bg-zinc-900/95 dark:bg-zinc-900/95 text-white p-3.5 rounded-xl border border-zinc-700/80 shadow-xl backdrop-blur-md text-xs min-w-[200px] space-y-2">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-semibold text-zinc-300">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} className="text-zinc-400" />
            {data?.fullDate || label}
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">
            {data?.weekday}
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ArrowDownLeft size={13} />
              Entradas (Compras/Reposição):
            </span>
            <span className="font-bold font-mono text-emerald-400">
              +{entradas} un
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-400">
              <ArrowUpRight size={13} />
              Saídas (Oficina/Requisição):
            </span>
            <span className="font-bold font-mono text-red-400">
              -{saidas} un
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 font-medium">
            <span className="text-zinc-400">Saldo Líquido do Dia:</span>
            <span className={`font-bold font-mono ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {saldo >= 0 ? `+${saldo}` : saldo} un
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const ProductMovementTrendChart: React.FC<ProductMovementTrendChartProps> = ({
  transactions,
  onSeeAllHistory,
  defaultDays = 7
}) => {
  const [daysRange, setDaysRange] = useState<7 | 14 | 30>(defaultDays);
  const [chartType, setChartType] = useState<'area' | 'bar' | 'composed'>('area');

  // Helper safe timestamp converter
  const parseDate = (ts: any): Date | null => {
    if (!ts) return null;
    try {
      if (typeof ts.toDate === 'function') return ts.toDate();
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  // Compute exact movement series for the selected timeframe (default 7 days)
  const trendData = useMemo(() => {
    const daysCount = daysRange;
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - i));
      
      const dayTargetStr = d.toDateString();
      const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const weekdayShort = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const fullDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

      const dayTxs = (transactions || []).filter(t => {
        const tDate = parseDate(t.timestamp);
        return tDate ? tDate.toDateString() === dayTargetStr : false;
      });

      const entradas = dayTxs
        .filter(t => t.type === 'in')
        .reduce((acc, t) => acc + (t.quantity || 0), 0);

      const saidas = dayTxs
        .filter(t => t.type === 'out')
        .reduce((acc, t) => acc + (t.quantity || 0), 0);

      return {
        date: dateLabel,
        displayLabel: daysCount === 7 ? `${weekdayShort} ${dateLabel}` : dateLabel,
        weekday: weekdayShort.toUpperCase(),
        fullDate,
        entradas,
        saidas,
        saldo: entradas - saidas,
        volumeTotal: entradas + saidas
      };
    });
  }, [transactions, daysRange]);

  // Aggregate metrics
  const totalIn = useMemo(() => trendData.reduce((acc, d) => acc + d.entradas, 0), [trendData]);
  const totalOut = useMemo(() => trendData.reduce((acc, d) => acc + d.saidas, 0), [trendData]);
  const netBalance = totalIn - totalOut;
  const avgDailyVolume = useMemo(() => Math.round(((totalIn + totalOut) / daysRange) * 10) / 10, [totalIn, totalOut, daysRange]);
  
  // Peak activity day
  const peakDay = useMemo(() => {
    let max = 0;
    let day = trendData[0];
    trendData.forEach(d => {
      if (d.volumeTotal > max) {
        max = d.volumeTotal;
        day = d;
      }
    });
    return max > 0 ? day : null;
  }, [trendData]);

  return (
    <div className="p-6 sm:p-7 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between transition-colors">
      <div>
        {/* Header with Title, Controls & Timeframe Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/50 dark:border-emerald-900/40">
                <Activity size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  Tendência de Entradas e Saídas
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200/60 dark:border-blue-800/50">
                    Últimos {daysRange} dias
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Monitoramento diário de compras de peças vs. requisições para ordens de serviço
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            {/* Chart Type Selector */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`flex items-center gap-1.5 px-2.5 py-1 font-semibold rounded-md transition-colors ${
                  chartType === 'area'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Visualização em Área Suave"
              >
                <LineChartIcon size={13} />
                <span className="hidden sm:inline">Tendência</span>
              </button>

              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`flex items-center gap-1.5 px-2.5 py-1 font-semibold rounded-md transition-colors ${
                  chartType === 'bar'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Visualização em Barras de Volume"
              >
                <BarChart3 size={13} />
                <span className="hidden sm:inline">Colunas</span>
              </button>

              <button
                type="button"
                onClick={() => setChartType('composed')}
                className={`flex items-center gap-1.5 px-2.5 py-1 font-semibold rounded-md transition-colors ${
                  chartType === 'composed'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Volume com Linha de Saldo"
              >
                <Layers size={13} />
                <span className="hidden sm:inline">Balanço</span>
              </button>
            </div>

            {/* Days Range Segmented Switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 text-xs">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysRange(d as 7 | 14 | 30)}
                  className={`px-2.5 py-1 font-semibold rounded-md transition-colors ${
                    daysRange === d
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-6 text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Entradas ({daysRange}d)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                +{totalIn}
              </span>
              <span className="text-[10px] text-zinc-400">unidades</span>
            </div>
          </div>

          <div className="space-y-0.5 sm:border-l sm:border-zinc-200/70 sm:dark:border-zinc-700/60 sm:pl-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Saídas ({daysRange}d)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-red-600 dark:text-red-400 font-mono tabular-nums">
                -{totalOut}
              </span>
              <span className="text-[10px] text-zinc-400">unidades</span>
            </div>
          </div>

          <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-zinc-200/70 dark:border-zinc-700/60 pt-2 sm:pt-0 sm:pl-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Saldo Líquido</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-base font-bold font-mono tabular-nums ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {netBalance >= 0 ? `+${netBalance}` : netBalance}
              </span>
              <span className="text-[10px] text-zinc-400">unidades</span>
            </div>
          </div>

          <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-zinc-200/70 dark:border-zinc-700/60 pt-2 sm:pt-0 sm:pl-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Média Operacional</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-zinc-900 dark:text-white font-mono tabular-nums">
                {avgDailyVolume}
              </span>
              <span className="text-[10px] text-zinc-400">un/dia</span>
            </div>
          </div>
        </div>

        {/* Dynamic Recharts Chart Area */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis 
                  dataKey="displayLabel" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <YAxis 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="entradas" 
                  name="Entradas" 
                  stroke="#10b981" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorEntradas)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="saidas" 
                  name="Saídas" 
                  stroke="#ef4444" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorSaidas)" 
                />
              </AreaChart>
            ) : chartType === 'bar' ? (
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis 
                  dataKey="displayLabel" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <YAxis 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            ) : (
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                <XAxis 
                  dataKey="displayLabel" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <YAxis 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#71717a' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  name="Saldo Líquido" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Info & Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Entradas de Compras
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Saídas para Oficina / OS
          </span>
          {chartType === 'composed' && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Saldo Líquido
            </span>
          )}
          {peakDay && (
            <span className="hidden md:inline-flex items-center gap-1 text-zinc-400">
              <Zap size={12} className="text-amber-500" />
              Pico: <strong>{peakDay.fullDate} ({peakDay.volumeTotal} un)</strong>
            </span>
          )}
        </div>

        {onSeeAllHistory && (
          <button 
            type="button"
            onClick={onSeeAllHistory}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 self-end sm:self-auto"
          >
            Histórico Integral <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductMovementTrendChart;
