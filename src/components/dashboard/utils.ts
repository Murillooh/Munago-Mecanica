import type { ServiceOrder } from '../../context/AppContext';

export const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export const formatBRLCompact = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(val || 0);

export const parseDate = (ts: any): Date | null => {
  if (!ts) return null;
  try {
    if (typeof ts.toDate === 'function') return ts.toDate();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Início do dia (00:00) de `daysAgo` dias atrás. */
export const startOfDayAgo = (daysAgo: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

export const isBilledOS = (os: ServiceOrder) => os.status === 'completed' || os.status === 'paid';

export const osAmount = (os: ServiceOrder) => (os as ServiceOrder & { finalAmount?: number }).finalAmount || os.totalAmount || 0;

/** Data de faturamento: conclusão, senão última atualização, senão criação. */
export const osBilledDate = (os: ServiceOrder) => parseDate(os.completionDate) || parseDate(os.updatedAt) || parseDate(os.createdAt);

// Paleta categórica validada (skill dataviz), ordem fixa: azul, laranja, água, amarelo, magenta, verde.
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
export const OTHER_LIGHT = '#a1a1aa';
export const OTHER_DARK = '#52525b';

// h-full + flex-1: cartões na mesma linha do grid ficam sempre com a mesma altura.
export const cardClass = 'h-full flex-1 p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between transition-colors';

// Ícones de cabeçalho no estilo iOS: degradê com brilho colorido (mesmo visual dos blocos do topo).
export const iconBadge = {
  blue: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white border-white/30 shadow-lg shadow-blue-500/30',
  emerald: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white border-white/30 shadow-lg shadow-emerald-500/30',
  amber: 'bg-gradient-to-br from-amber-300 to-orange-500 text-white border-white/30 shadow-lg shadow-amber-500/30',
  red: 'bg-gradient-to-br from-rose-400 to-pink-600 text-white border-white/30 shadow-lg shadow-rose-500/30',
  indigo: 'bg-gradient-to-br from-indigo-400 to-blue-700 text-white border-white/30 shadow-lg shadow-indigo-500/30',
  violet: 'bg-gradient-to-br from-fuchsia-400 to-violet-600 text-white border-white/30 shadow-lg shadow-violet-500/30',
} as const;
