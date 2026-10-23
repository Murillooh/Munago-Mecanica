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
    <section aria-labelledby={titleId} className="relative shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-4 text-white shadow-xl shadow-blue-900/20 sm:p-6">
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
  const tone = alert
    ? 'border-rose-400/60 bg-gradient-to-br from-rose-500/25 to-violet-600/30 hover:from-rose-500/35'
    : selected
      ? 'border-white/70 bg-white/25 ring-2 ring-white/40'
      : 'border-white/20 bg-white/10 hover:bg-white/15';
  const body = (
    <>
      <div className="flex w-full items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ${iconClass}`}>
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
  const cls = `flex flex-col justify-between rounded-2xl border p-4 text-left text-white backdrop-blur-md transition-colors ${tone} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};
