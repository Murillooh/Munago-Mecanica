import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import type { ServiceOrder } from '../../context/AppContext';
import { cardClass, formatBRL, formatBRLCompact, iconBadge, isBilledOS, osAmount, osBilledDate, startOfDayAgo } from './utils';

type Range = '30d' | '12m';

interface Bucket {
  label: string;
  fullLabel: string;
  total: number;
  count: number;
}

const RevenueTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  const d: Bucket = payload[0].payload;
  return (
    <div className="bg-zinc-900/95 text-white p-3 rounded-xl border border-zinc-700/80 shadow-xl text-xs min-w-[170px] space-y-1.5">
      <p className="font-semibold text-zinc-300 border-b border-zinc-800 pb-1.5">{d.fullLabel}</p>
      <div className="flex justify-between gap-4">
        <span className="text-zinc-400">Faturado</span>
        <span className="font-bold tabular-nums">{formatBRL(d.total)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-zinc-400">OS concluídas</span>
        <span className="font-bold tabular-nums">{d.count}</span>
      </div>
    </div>
  );
};

export const OSRevenueChart: React.FC<{ serviceOrders: ServiceOrder[]; darkMode: boolean; onOpenOS?: () => void }> = ({
  serviceOrders,
  darkMode,
  onOpenOS,
}) => {
  const [range, setRange] = useState<Range>('30d');
  const stroke = darkMode ? '#3987e5' : '#2a78d6';

  const billed = useMemo(
    () =>
      (serviceOrders || [])
        .filter(isBilledOS)
        .map(os => ({ date: osBilledDate(os), amount: osAmount(os) }))
        .filter((o): o is { date: Date; amount: number } => !!o.date),
    [serviceOrders]
  );

  const { buckets, total, count, prevTotal } = useMemo(() => {
    let buckets: Bucket[];
    let start: Date;
    let prevStart: Date;

    if (range === '30d') {
      start = startOfDayAgo(29);
      prevStart = startOfDayAgo(59);
      buckets = Array.from({ length: 30 }, (_, i) => {
        const d = startOfDayAgo(29 - i);
        return {
          label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          fullLabel: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }),
          total: 0,
          count: 0,
        };
      });
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 23, 1);
      buckets = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        return {
          label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          fullLabel: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
          total: 0,
          count: 0,
        };
      });
    }

    let total = 0;
    let count = 0;
    let prevTotal = 0;
    billed.forEach(({ date, amount }) => {
      if (date >= start) {
        const idx = range === '30d'
          ? Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
          : (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
        if (idx >= 0 && idx < buckets.length) {
          buckets[idx].total += amount;
          buckets[idx].count += 1;
          total += amount;
          count += 1;
        }
      } else if (date >= prevStart) {
        prevTotal += amount;
      }
    });

    return { buckets, total, count, prevTotal };
  }, [billed, range]);

  const ticket = count > 0 ? total / count : 0;
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const prevLabel = range === '30d' ? '30 dias anteriores' : '12 meses anteriores';

  return (
    <div className={cardClass}>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className={`p-1.5 rounded-xl border ${iconBadge.blue}`}>
              <DollarSign size={16} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">Faturamento de Ordens de Serviço</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">OS concluídas e pagas no período</p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 text-xs self-start sm:self-auto" role="group" aria-label="Período">
            {(['30d', '12m'] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-2.5 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                  range === r ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {r === '30d' ? '30 dias' : '12 meses'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-4 text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Total faturado</span>
            <p className="text-base font-bold text-zinc-900 dark:text-white tabular-nums">{formatBRL(total)}</p>
            {delta !== null && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                title={`Comparado aos ${prevLabel}`}
              >
                {delta >= 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
                {delta >= 0 ? '+' : ''}{delta}% vs. {prevLabel}
              </span>
            )}
          </div>
          <div className="space-y-0.5 border-l border-zinc-200/70 dark:border-zinc-700/60 pl-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">OS concluídas</span>
            <p className="text-base font-bold text-zinc-900 dark:text-white tabular-nums">{count}</p>
          </div>
          <div className="space-y-0.5 border-l border-zinc-200/70 dark:border-zinc-700/60 pl-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Ticket médio</span>
            <p className="text-base font-bold text-zinc-900 dark:text-white tabular-nums">{formatBRL(ticket)}</p>
          </div>
        </div>

        <div className="h-[200px] w-full" role="img" aria-label={`Gráfico de faturamento: ${formatBRL(total)} em ${count} OS`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="osRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} interval={range === '30d' ? 4 : 0} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} tickFormatter={v => formatBRLCompact(v)} width={64} />
              <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#a1a1aa', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="total" name="Faturado" stroke={stroke} strokeWidth={2} fill="url(#osRevenueFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: darkMode ? '#18181b' : '#ffffff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {onOpenOS && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
          <span>Data de referência: conclusão da OS</span>
          <button type="button" onClick={onOpenOS} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
            Ordens de Serviço <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default OSRevenueChart;
