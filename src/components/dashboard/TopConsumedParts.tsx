import React, { useMemo } from 'react';
import { Flame, ChevronRight } from 'lucide-react';
import type { Product, Transaction } from '../../context/AppContext';
import { cardClass, iconBadge, parseDate, startOfDayAgo } from './utils';

const WINDOW_DAYS = 30;

export const TopConsumedParts: React.FC<{ transactions: Transaction[]; products: Product[]; onSeeAllHistory?: () => void }> = ({
  transactions,
  products,
  onSeeAllHistory,
}) => {
  const { top, totalOut } = useMemo(() => {
    const start = startOfDayAgo(WINDOW_DAYS - 1);
    const byProduct = new Map<string, { name: string; qty: number; moves: number }>();
    let totalOut = 0;
    (transactions || []).forEach(t => {
      if (t.type !== 'out') return;
      const d = parseDate(t.timestamp);
      if (!d || d < start) return;
      const entry = byProduct.get(t.productId) || { name: t.productName, qty: 0, moves: 0 };
      entry.qty += t.quantity || 0;
      entry.moves += 1;
      byProduct.set(t.productId, entry);
      totalOut += t.quantity || 0;
    });
    const stock = new Map<string, Product>((products || []).map(p => [p.id, p]));
    const top = Array.from(byProduct.entries())
      .map(([id, v]) => ({ id, ...v, name: stock.get(id)?.name || v.name || 'Item sem nome', sku: stock.get(id)?.sku }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
    return { top, totalOut };
  }, [transactions, products]);

  const max = top[0]?.qty || 1;

  return (
    <div className={cardClass}>
      <div>
        <div className="flex items-center gap-2.5 mb-6">
          <span className={`p-2 rounded-xl border ${iconBadge.amber}`}>
            <Flame size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Peças Mais Consumidas</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Saídas nos últimos {WINDOW_DAYS} dias</p>
          </div>
        </div>

        {top.length > 0 ? (
          <ol className="space-y-4">
            {top.map((item, idx) => {
              const share = totalOut > 0 ? Math.round((item.qty / totalOut) * 100) : 0;
              return (
                <li key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={item.name}>{item.name}</span>
                    </span>
                    <span className="shrink-0 text-zinc-500 dark:text-zinc-400 tabular-nums">
                      <strong className="text-zinc-900 dark:text-white">{item.qty} un</strong> · {share}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (item.qty / max) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            Nenhuma saída registrada nos últimos {WINDOW_DAYS} dias.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500">
        <span className="tabular-nums">{totalOut} un consumidas no período</span>
        {onSeeAllHistory && (
          <button type="button" onClick={onSeeAllHistory} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
            Histórico <ChevronRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default TopConsumedParts;
