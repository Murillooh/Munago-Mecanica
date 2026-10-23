import React from 'react';
import { ChevronRight } from 'lucide-react';

/** Botões sobre o degradê azul: contorno branco (secundário) e branco com texto azul (principal). */
export const heroBtn =
  'inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
export const heroBtnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/**
 * Topo das telas no estilo iOS: degradê azul com pontilhado, título, ações e (opcional) indicadores em vidro.
 * `children` são os HeroStat, num grid de até 4 colunas.
 */
export const PageHero: React.FC<{
  icon?: React.ElementType;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Linha pequena acima do título (data, status...). */
  eyebrow?: React.ReactNode;
  /** Texto pequeno na mesma linha do título, logo depois dele (quebra para baixo se não couber). */
  titleAside?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** Classes do grid de indicadores (padrão: 1 → 2 → 4 colunas). */
  statsClassName?: string;
  /** id do grid de indicadores (o Modo Monitor rola até ele). */
  statsId?: string;
}> = ({ icon: Icon, title, subtitle, eyebrow, titleAside, actions, children, statsClassName, statsId }) => {
  const titleId = React.useId();
  return (
    <section aria-labelledby={titleId} className="relative shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-800 p-4 text-white shadow-xl shadow-blue-900/25 sm:p-6">
      {/* Halos de luz para o degradê não ficar chapado */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-cyan-400/35 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-0 h-80 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          maskImage: 'linear-gradient(to left, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to left, black, transparent)',
        }}
      />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-blue-100/90">{eyebrow}</div>}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 id={titleId} className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              {Icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15">
                  <Icon size={19} aria-hidden="true" />
                </span>
              )}
              {title}
            </h1>
            {titleAside && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-blue-100/90">{titleAside}</div>}
          </div>
          {subtitle && <p className="mt-1 text-xs text-blue-100/85 sm:text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>

      {children && (
        <div id={statsId} className={`relative mt-5 grid gap-3 ${statsClassName ?? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
          {children}
        </div>
      )}
    </section>
  );
};

/**
 * Cor de cada indicador, a partir da cor do ícone: degradê do bloco, ícone em degradê e o brilho colorido dele.
 * Classes escritas por extenso para o Tailwind gerar.
 */
const VIVID: Record<string, { tile: string; icon: string; glow: string }> = {
  'bg-blue-500': { tile: 'from-sky-400/35 via-blue-500/15 to-blue-600/10 border-sky-200/45', icon: 'bg-gradient-to-br from-sky-400 to-blue-600', glow: 'shadow-sky-500/50' },
  'bg-sky-500': { tile: 'from-cyan-400/35 via-sky-500/15 to-sky-600/10 border-cyan-200/45', icon: 'bg-gradient-to-br from-cyan-400 to-sky-600', glow: 'shadow-cyan-500/50' },
  'bg-emerald-500': { tile: 'from-emerald-400/35 via-teal-500/15 to-emerald-600/10 border-emerald-200/45', icon: 'bg-gradient-to-br from-emerald-400 to-teal-600', glow: 'shadow-emerald-500/50' },
  'bg-violet-500': { tile: 'from-fuchsia-400/30 via-violet-500/20 to-violet-600/10 border-violet-200/45', icon: 'bg-gradient-to-br from-fuchsia-400 to-violet-600', glow: 'shadow-violet-500/50' },
  'bg-amber-500': { tile: 'from-amber-300/35 via-orange-400/15 to-orange-500/10 border-amber-200/45', icon: 'bg-gradient-to-br from-amber-300 to-orange-500', glow: 'shadow-amber-500/50' },
  'bg-rose-500': { tile: 'from-rose-400/35 via-pink-500/15 to-rose-600/10 border-rose-200/45', icon: 'bg-gradient-to-br from-rose-400 to-pink-600', glow: 'shadow-rose-500/50' },
  'bg-zinc-500': { tile: 'from-white/20 via-white/10 to-white/5 border-white/30', icon: 'bg-gradient-to-br from-slate-300 to-slate-500', glow: 'shadow-slate-500/40' },
  default: { tile: 'from-white/20 via-white/10 to-white/5 border-white/30', icon: 'bg-gradient-to-br from-sky-400 to-blue-600', glow: 'shadow-blue-500/40' },
};

/**
 * Indicador em vidro dentro do PageHero. Com `onClick` vira botão (com seta);
 * `selected` marca filtro ativo; `alert` usa o tom vermelho/roxo de urgência.
 */
export const HeroStat: React.FC<{
  icon: React.ElementType;
  /** Cor do quadrado do ícone, ex.: "bg-blue-500". */
  iconClass: string;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Ao lado do valor (ex.: mini gráfico). */
  aside?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  alert?: boolean;
  className?: string;
}> = ({ icon: Icon, iconClass, label, value, hint, aside, onClick, selected, alert, className = '' }) => {
  const vivid = VIVID[iconClass] ?? VIVID.default;
  const tone = alert
    ? 'border-rose-300/70 bg-gradient-to-br from-rose-500/45 via-pink-500/25 to-violet-600/40 shadow-lg shadow-rose-900/30 hover:from-rose-500/55'
    : selected
      ? `bg-gradient-to-br ${vivid.tile} border-white/80 ring-2 ring-white/50`
      : `bg-gradient-to-br ${vivid.tile} hover:brightness-110`;
  const body = (
    <>
      <div className="flex w-full items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-lg ring-1 ring-white/35 ${vivid.icon} ${vivid.glow}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
        {/* Quebra em vez de cortar: no celular os blocos ficam 2 por linha. */}
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{label}</span>
        {alert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400 motion-safe:animate-pulse" aria-hidden="true" />}
        {/* No celular o bloco é estreito: sem a seta (continua clicável). */}
        {onClick && <ChevronRight size={16} className="hidden shrink-0 text-blue-100/80 sm:block" aria-hidden="true" />}
      </div>
      <div className="mt-3 flex w-full items-center justify-between gap-3">
        <div className="whitespace-nowrap text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</div>
        {aside && <div className="w-14 min-w-0 shrink">{aside}</div>}
      </div>
      {hint && <div className="mt-1 text-xs text-blue-100/85">{hint}</div>}
    </>
  );
  // Brilho de vidro no topo + leve subida ao passar o mouse (sem animação para quem pediu menos movimento).
  const cls = `flex flex-col justify-between rounded-2xl border p-4 text-left text-white backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] transition duration-200 motion-safe:hover:-translate-y-0.5 ${tone} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};
