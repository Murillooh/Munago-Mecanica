import React, { useMemo } from 'react';
import { Hourglass, AlertOctagon, AlertTriangle, CheckCircle2, MinusCircle, ChevronRight } from 'lucide-react';
import type { Product, Transaction } from '../../context/AppContext';
import { cardClass, iconBadge, parseDate, startOfDayAgo } from './utils';

const WINDOW_DAYS = 30;
const CRITICAL_DAYS = 7;
const WARNING_DAYS = 15;
const BAR_SCALE_DAYS = 30;

type Level = 'critical' | 'warning' | 'ok';

const LEVEL = {
  critical: { label: 'Crítico', icon: AlertOctagon, text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', chip: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' },
  warning: { label: 'Atenção', icon: AlertTriangle, text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
  ok: { label: 'OK', icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
} as const;

const levelOf = (days: number): Level => (days <= CRITICAL_DAYS ? 'critical' : days <= WARNING_DAYS ? 'warning' : 'ok');

export const StockCoverage: React.FC<{ products: Product[]; transactions: Transaction[]; onSeeAll?: () => void }> = ({
  products,
  transactions,
  onSeeAll,
}) => {
  const { rows, counts, idle } = useMemo(() => {
    const start = startOfDayAgo(WINDOW_DAYS - 1);
    const out = new Map<string, number>();
    (transactions || []).forEach(t => {
      if (t.type !== 'out') return;
      const d = parseDate(t.timestamp);
      if (!d || d < start) return;
      out.set(t.productId, (out.get(t.productId) || 0) + (t.quantity || 0));
    });

    const counts = { critical: 0, warning: 0, ok: 0 };
    let idle = 0;
    const rows: { id: string; name: string; qty: number; daily: number; days: number; level: Level }[] = [];
    (products || []).forEach(p => {
      const consumed = out.get(p.id) || 0;
      if (consumed <= 0) {
        if ((p.quantity || 0) > 0) idle += 1;
        return;
      }
      const daily = consumed / WINDOW_DAYS;
      const days = Math.max(0, (p.quantity || 0) / daily);
      const level = levelOf(days);
      counts[level] += 1;
      rows.push({ id: p.id, name: p.name, qty: p.quantity || 0, daily, days, level });
    });
    rows.sort((a, b) => a.days - b.days);
    return { rows: rows.slice(0, 8), counts, idle };
  }, [products, transactions]);

  return (
    <div className={cardClass}>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <span className={`p-2 rounded-xl border ${iconBadge.indigo}`}>
              <Hourglass size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Cobertura de Estoque</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Quantos dias cada peça dura no ritmo de consumo dos últimos {WINDOW_DAYS} dias
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            {(['critical', 'warning', 'ok'] as const).map(l => {
              const { icon: Icon, label, chip } = LEVEL[l];
              return (
                <span key={l} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${chip}`}>
                  <Icon size={12} aria-hidden="true" /> {label}: <span className="tabular-nums">{counts[l]}</span>
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" title="Itens com saldo, mas sem nenhuma saída no período">
              <MinusCircle size={12} aria-hidden="true" /> Sem giro: <span className="tabular-nums">{idle}</span>
            </span>
          </div>
        </div>

        {rows.length > 0 ? (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            {rows.map(r => {
              const { text, bar, label } = LEVEL[r.level];
              const daysLabel = r.qty === 0 ? 'Zerado' : r.days < 1 ? '< 1 dia' : `${Math.floor(r.days)} dias`;
              return (
                <li key={r.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={r.name}>{r.name}</span>
                    <span className={`shrink-0 font-bold tabular-nums ${text}`}>
                      {daysLabel} <span className="sr-only">({label})</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(3, (r.days / BAR_SCALE_DAYS) * 100))}%` }} />
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {r.qty} un em estoque · consumo de {r.daily.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} un/dia
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            Sem saídas nos últimos {WINDOW_DAYS} dias para calcular a cobertura.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
        <span>Crítico: até {CRITICAL_DAYS} dias · Atenção: até {WARNING_DAYS} dias · Barra cheia = {BAR_SCALE_DAYS}+ dias</span>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer shrink-0">
            Almoxarifado <ChevronRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StockCoverage;
