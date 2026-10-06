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

export const cardClass = 'p-6 sm:p-7 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between transition-colors';

export const iconBadge = {
  blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/40',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/40',
  indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/40',
  violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200/50 dark:border-violet-900/40',
} as const;
