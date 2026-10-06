import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

/** Mini tendência decorativa para cards de indicador (o número do card é a informação principal). */
export const Sparkline: React.FC<{ data: number[]; color: string; id: string }> = ({ data, color, id }) => (
  <div className="h-10 w-full" aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default Sparkline;
