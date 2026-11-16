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
const ClassicHero = React.createContext(false);

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
  /** Visual antigo (gradiente índigo): só no topo do painel inicial. */
  classic?: boolean;
}> = ({ icon: Icon, title, subtitle, eyebrow, titleAside, actions, children, statsClassName, statsId, classic }) => {
  const titleId = React.useId();
  return (
    <ClassicHero.Provider value={!!classic}>
    <section aria-labelledby={titleId} className={`@container relative shrink-0 overflow-hidden p-4 sm:p-5 text-white ${classic
      ? 'rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#4d4ca6] via-[#3b3995] to-[#2c2878] shadow-xl shadow-black/40'
      : 'rounded-xl border border-slate-700/60 bg-[#16233a] shadow-sm'}`}>
      {classic && <>
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-indigo-300/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent)]" />
      </>}
      <div className="relative flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs font-medium text-blue-100/80">
              {eyebrow}
            </div>
          )}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id={titleId} className="flex items-center gap-2 text-2xl @5xl:text-3xl font-bold tracking-tight leading-tight">
              {Icon && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
                  <Icon size={17} aria-hidden="true" />
                </span>
              )}
              {title}
            </h1>
            {titleAside && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs font-medium text-blue-100/80">
                {titleAside}
              </div>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-blue-50/80">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 @3xl:justify-end">{actions}</div>
        )}
      </div>

      {children && (
        <div id={statsId} className={`relative mt-3 sm:mt-4 grid gap-2 sm:gap-3 ${statsClassName ?? 'grid-cols-2 @3xl:grid-cols-4'}`}>
          {children}
        </div>
      )}
    </section>
    </ClassicHero.Provider>
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
  const classic = React.useContext(ClassicHero);
  const tone = classic
    ? alert ? 'border-rose-500/80 bg-fuchsia-700/40 hover:bg-fuchsia-700/50'
      : selected ? 'border-white/70 bg-white/20 ring-2 ring-white/40'
      : 'border-indigo-200/35 bg-indigo-500/45 hover:bg-indigo-500/55'
    : alert ? 'border-rose-400/60 bg-rose-500/15 hover:bg-rose-500/20'
      : selected ? 'border-white/60 bg-white/15 ring-1 ring-white/40'
      : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]';
  const body = (
    <>
      <div className="flex w-full items-center gap-1.5">
        <span className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg shadow-md ring-1 ring-inset ring-white/25 ${iconClass}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-xs @5xl:text-sm font-semibold leading-tight text-white line-clamp-2">{label}</span>
        {alert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />}
        {onClick && <ChevronRight size={16} className="hidden shrink-0 text-white/50 sm:block" aria-hidden="true" />}
      </div>
      <div className="mt-2 flex w-full items-end justify-between gap-2">
        <div className="whitespace-nowrap text-[clamp(1.15rem,2.3cqi,1.75rem)] font-bold tracking-tight tabular-nums leading-none">{value}</div>
        {aside && <div className="w-16 sm:w-20 min-w-0 shrink hidden xs:block">{aside}</div>}
      </div>
      {hint && <div className="mt-1 text-[11px] @5xl:text-xs font-medium text-white/85 line-clamp-1">{hint}</div>}
    </>
  );
  const cls = `flex flex-col justify-between ${classic ? 'rounded-2xl' : 'rounded-xl'} border p-3 @5xl:p-4 text-left text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_24px_-12px_rgb(30_27_75/0.5)] transition-colors duration-200 ${tone} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};
