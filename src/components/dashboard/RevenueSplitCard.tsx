import React, { useMemo } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { ServiceOrder } from '../../context/AppContext';
import { cardClass, formatBRL, iconBadge } from './utils';

/** Soma do repasse das OS pagas num mês (pela data do pagamento, congelada pelo servidor). */
function monthTotals(orders: ServiceOrder[], year: number, month: number) {
  let total = 0, company = 0, workshop = 0, count = 0;
  for (const os of orders) {
    if (os.status !== 'paid' || !os.paidAt || os.companyAmount == null) continue;
    const d = new Date(os.paidAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    company += os.companyAmount;
    workshop += os.workshopAmount ?? 0;
    total += (os.companyAmount ?? 0) + (os.workshopAmount ?? 0);
    count++;
  }
  return { total, company, workshop, count };
}

export const RevenueSplitCard: React.FC<{ serviceOrders: ServiceOrder[] }> = ({ serviceOrders }) => {
  const now = new Date();
  const { cur, prev, legacy } = useMemo(() => {
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      cur: monthTotals(serviceOrders, now.getFullYear(), now.getMonth()),
      prev: monthTotals(serviceOrders, prevDate.getFullYear(), prevDate.getMonth()),
      // Pagas antes do repasse existir: não entram na divisão.
      legacy: serviceOrders.filter(os => os.status === 'paid' && os.companyAmount == null).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOrders, now.getMonth()]);

  const companyPct = cur.total ? (cur.company / cur.total) * 100 : 0;
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <section aria-labelledby="split-card-title" className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="split-card-title" className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Repasses do mês</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            OS pagas em {monthName} · {cur.count} {cur.count === 1 ? 'ordem' : 'ordens'}
          </p>
        </div>
        <span className={`rounded-xl border p-2 ${iconBadge.emerald}`}><ArrowLeftRight size={16} aria-hidden="true" /></span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Recebido</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">{formatBRL(cur.total)}</p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">mês anterior {formatBRL(prev.total)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"><span className="h-2 w-2 rounded-sm bg-blue-600" aria-hidden="true" /> Empresa</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">{formatBRL(cur.company)}</p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">{companyPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do recebido</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"><span className="h-2 w-2 rounded-sm bg-emerald-500" aria-hidden="true" /> Oficina</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">{formatBRL(cur.workshop)}</p>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">{(cur.total ? 100 - companyPct : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do recebido</p>
        </div>
      </div>

      <div
        className="mt-6 flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        role="img"
        aria-label={`Empresa ${formatBRL(cur.company)}, oficina ${formatBRL(cur.workshop)}`}
      >
        {cur.total > 0 && (
          <>
            <span className="bg-blue-600" style={{ width: `${companyPct}%` }} />
            <span className="bg-emerald-500" style={{ width: `${100 - companyPct}%` }} />
          </>
        )}
      </div>

      {legacy > 0 && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          {legacy} {legacy === 1 ? 'OS paga' : 'OS pagas'} antes do repasse existir: fora desta divisão. Para incluir, abra e salve como Pago novamente.
        </p>
      )}
    </section>
  );
};
