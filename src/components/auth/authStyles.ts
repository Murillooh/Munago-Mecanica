import type React from 'react';

/** Camadas do fundo das telas de acesso (login e espera de aprovação): pontilhado, luz azul e vinheta. */
const GRID_MASK = 'radial-gradient(ellipse 95% 90% at 50% 50%, #000 45%, transparent 100%)';

export const AUTH_BG: Record<'glow' | 'grid' | 'vignette', React.CSSProperties> = {
  glow: {
    background:
      'radial-gradient(ellipse 70% 60% at 50% 48%, rgba(37,99,235,0.22), transparent 72%),' +
      'radial-gradient(ellipse 35% 35% at 12% 88%, rgba(79,70,229,0.12), transparent 70%),' +
      'radial-gradient(ellipse 35% 35% at 88% 10%, rgba(37,99,235,0.10), transparent 70%)',
  },
  grid: {
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1.5px)',
    backgroundSize: '22px 22px',
    backgroundPosition: 'center center',
    maskImage: GRID_MASK,
    WebkitMaskImage: GRID_MASK,
  },
  vignette: {
    background: 'radial-gradient(ellipse 90% 85% at 50% 50%, transparent 60%, rgba(0,0,0,0.5) 100%)',
  },
};

/** Pontilhado do painel azul: mesma linguagem do fundo, em branco translúcido. */
export const AUTH_PANEL_GRID: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1.5px)',
  backgroundSize: '18px 18px',
  maskImage: 'linear-gradient(135deg, #000 0%, transparent 70%)',
  WebkitMaskImage: 'linear-gradient(135deg, #000 0%, transparent 70%)',
};

/** Personagem 3D da oficina usado no painel azul. */
export const AUTH_CHARACTER_URL = 'https://cdn3d.iconscout.com/3d/premium/thumb/man-standing-with-hand-on-waist-5691550-4741094.png';
