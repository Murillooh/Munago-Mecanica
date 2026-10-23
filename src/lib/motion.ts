import type { Transition } from 'motion/react';

/**
 * Movimento no estilo macOS/iOS: molas criticamente amortecidas (rápidas, sem "quicar").
 * `iosSpring` é o padrão do app (MotionConfig em App.tsx); componentes só passam transition quando precisam de outra.
 */
export const iosSpring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };

/** Janelas e painéis que sobem (um pouco mais macios). */
export const iosSheet: Transition = { type: 'spring', stiffness: 340, damping: 34, mass: 1 };

/** Janela abrindo como no Mac: cresce de leve a partir do centro. */
export const iosPop = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};
