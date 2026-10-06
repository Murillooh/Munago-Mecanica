import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import type { Product } from '../../context/AppContext';
import { OTHER_DARK, OTHER_LIGHT, SERIES_DARK, SERIES_LIGHT, cardClass, formatBRL, formatBRLCompact, iconBadge } from './utils';

const MAX_SLICES = 5;

interface Slice {
  name: string;
  value: number;
  qty: number;
  share: number;
  color: string;
}

const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  const s: Slice = payload[0].payload;
  return (
    <div className="bg-zinc-900/95 text-white p-3 rounded-xl border border-zinc-700/80 shadow-xl text-xs min-w-[160px] space-y-1">
      <p className="font-semibold">{s.name}</p>
      <p className="text-zinc-300 tabular-nums">{formatBRL(s.value)} · {s.share}%</p>
      <p className="text-zinc-400 tabular-nums">{s.qty} un em estoque</p>
    </div>
  );
};

export const CategoryDonut: React.FC<{ products: Product[]; darkMode: boolean }> = ({ products, darkMode }) => {
  const { slices, total } = useMemo(() => {
    const map = new Map<string, { value: number; qty: number }>();
    (products || []).forEach(p => {
      const cat = p.category || 'Geral';
      const e = map.get(cat) || { value: 0, qty: 0 };
      e.value += (p.price || 0) * (p.quantity || 0);
      e.qty += p.quantity || 0;
      map.set(cat, e);
    });
    const total = Array.from(map.values()).reduce((a, e) => a + e.value, 0);
    const sorted = Array.from(map.entries()).map(([name, e]) => ({ name, ...e })).sort((a, b) => b.value - a.value);

    // Cor segue a categoria pela posição no ranking de valor; a partir da 6ª, tudo vira "Outras".
    const palette = darkMode ? SERIES_DARK : SERIES_LIGHT;
    const head = sorted.slice(0, MAX_SLICES);
    const tail = sorted.slice(MAX_SLICES);
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const slices: Slice[] = head.map((c, i) => ({ ...c, share: pct(c.value), color: palette[i] }));
    if (tail.length) {
      const value = tail.reduce((a, c) => a + c.value, 0);
      const qty = tail.reduce((a, c) => a + c.qty, 0);
      slices.push({ name: `Outras (${tail.length})`, value, qty, share: pct(value), color: darkMode ? OTHER_DARK : OTHER_LIGHT });
    }
    return { slices, total };
  }, [products, darkMode]);

  const hasValue = total > 0;

  return (
    <div className={cardClass}>
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`p-2 rounded-xl border ${iconBadge.violet}`}>
            <PieChartIcon size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Valor por Categoria</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Onde está o dinheiro parado no estoque</p>
          </div>
        </div>

        {hasValue ? (
          <>
            <div className="relative h-[190px] w-full" role="img" aria-label={`Valor do estoque por categoria, total ${formatBRL(total)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    stroke={darkMode ? '#18181b' : '#ffffff'}
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {slices.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">Total</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{formatBRLCompact(total)}</span>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {slices.map(s => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={s.name}>{s.name}</span>
                  </span>
                  <span className="shrink-0 text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {formatBRLCompact(s.value)} · <strong className="text-zinc-900 dark:text-white">{s.share}%</strong>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-zinc-500 py-10 text-center">Cadastre preços nos produtos para ver a distribuição de valor.</p>
        )}
      </div>
    </div>
  );
};

export default CategoryDonut;
