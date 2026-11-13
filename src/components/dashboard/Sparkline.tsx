import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

/** Mini tendência decorativa para cards de indicador (o número do card é a informação principal). */
/** Média móvel: dia a dia oscila demais (domingo zerado) e a linha vira serrote; a tendência é o que importa aqui. */
const smooth = (data: number[]) => {
  const w = Math.max(1, Math.round(data.length / 5));
  return data.map((_, i) => {
    const part = data.slice(Math.max(0, i - w + 1), i + 1);
    return part.reduce((a, v) => a + v, 0) / part.length;
  });
};

export const Sparkline: React.FC<{ data: number[]; color: string; id: string }> = ({ data, color, id }) => (
  <div className="h-10 w-full" aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={smooth(data).map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} strokeLinecap="round" fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default Sparkline;
