import type React from 'react';
import type { Transition } from 'motion/react';

/**
 * Movimento no estilo macOS/iOS: molas criticamente amortecidas (rápidas, sem "quicar").
 * `iosSpring` é o padrão do app (MotionConfig em App.tsx); componentes só passam transition quando precisam de outra.
 */
export const iosSpring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };

/** Janelas e painéis que sobem (um pouco mais macios). */
export const iosSheet: Transition = { type: 'spring', stiffness: 340, damping: 34, mass: 1 };

/*
 * "Abrir app" do macOS: a janela nasce pequena no ponto clicado e voa crescendo até o centro; ao fechar, volta pra lá.
 * Guardamos o último clique feito FORA de janelas (clicar em "Fechar" não muda a origem).
 */
const DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"], .fixed.inset-0';
let origin = { x: 0, y: 0, t: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    if ((e.target as Element | null)?.closest?.(DIALOG_SELECTOR)) return;
    origin = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, { capture: true, passive: true });
}

/** Deslocamento do ponto clicado até o centro da tela (janelas abrem centralizadas). Sem clique recente: centro. */
function clickOffset(requireRecent: boolean) {
  if (typeof window === 'undefined' || (requireRecent && Date.now() - origin.t > 2000) || !origin.t) return { x: 0, y: 0 };
  return { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2 };
}

/** Mola do zoom de abrir janela (um pouco mais longa que a padrão, como no macOS). */
export const macZoom: Transition = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };

/** Props de motion para a janela popup: `<motion.div {...macZoomProps()} transition={macZoom}>`. */
export const macZoomProps = () => {
  const from = clickOffset(true);
  const back = clickOffset(false);
  return {
    initial: { opacity: 0, scale: 0.08, x: from.x, y: from.y },
    animate: { opacity: 1, scale: 1, x: 0, y: 0 },
    exit: { opacity: 0, scale: 0.08, x: back.x, y: back.y },
  };
};

/** Para janelas sem motion (classe .ios-pop): variáveis CSS com a origem do clique. */
export const macZoomStyle = (): React.CSSProperties => {
  const o = clickOffset(true);
  return { '--zx': `${o.x}px`, '--zy': `${o.y}px` } as React.CSSProperties;
};

/** Janela abrindo como no Mac: cresce de leve a partir do centro. */
export const iosPop = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};
