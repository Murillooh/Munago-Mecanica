import React from 'react';
import { ChevronRight } from 'lucide-react';

/** Botões sobre o degradê azul: contorno branco (secundário) e branco com texto azul (principal). */
export const heroBtn =
  'inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
export const heroBtnPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/**
 * Topo das telas no estilo iOS: degradê azul, título, ações e (opcional) indicadores em vidro.
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
    <section aria-labelledby={titleId} className="relative shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-900/20 sm:p-6">
      {/* Só um brilho suave no canto, longe do texto, para o degradê não ficar chapado */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-blue-50">{eyebrow}</div>}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 id={titleId} className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              {Icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
                  <Icon size={19} aria-hidden="true" />
                </span>
              )}
              {title}
            </h1>
            {titleAside && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-blue-50">{titleAside}</div>}
          </div>
          {subtitle && <p className="mt-1 text-sm text-blue-50/90">{subtitle}</p>}
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
 * `selected` marca filtro ativo; `alert` usa o tom vermelho de urgência.
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
    ? 'border-rose-300/60 bg-rose-500/20 hover:bg-rose-500/25'
    : selected
      ? 'border-white/70 bg-white/20 ring-2 ring-white/40'
      : 'border-white/15 bg-white/10 hover:bg-white/15';
  const body = (
    <>
      <div className="flex w-full items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-inset ring-white/25 ${iconClass}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
        {/* Quebra em vez de cortar: no celular os blocos ficam 2 por linha. */}
        <span className="min-w-0 flex-1 text-sm font-medium leading-tight text-blue-50">{label}</span>
        {alert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300 motion-safe:animate-pulse" aria-hidden="true" />}
        {/* No celular o bloco é estreito: sem a seta (continua clicável). */}
        {onClick && <ChevronRight size={16} className="hidden shrink-0 text-blue-50/80 sm:block" aria-hidden="true" />}
      </div>
      <div className="mt-3 flex w-full items-center justify-between gap-3">
        <div className="whitespace-nowrap text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</div>
        {aside && <div className="w-20 min-w-0 shrink">{aside}</div>}
      </div>
      {hint && <div className="mt-1 text-xs text-blue-50/90">{hint}</div>}
    </>
  );
  const cls = `flex flex-col justify-between rounded-2xl border p-4 text-left text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] transition-colors duration-200 ${tone} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};
