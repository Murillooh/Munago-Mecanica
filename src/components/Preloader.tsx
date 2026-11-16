import React from 'react';

const DEPTH = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** Logo 3D (estilos .mp-* no head do index.html): camadas empilhadas em Z dão a espessura; o ícone flutua à frente. */
export const Logo3D: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div className={`mp-scene ${className}`} style={style} aria-hidden="true">
    <div className="mp-logo">
      {DEPTH.map(d => <i key={d} className="mp-depth" style={{ '--d': d } as React.CSSProperties} />)}
      <div className="mp-tile" />
      <svg className="mp-edges" viewBox="0 0 132 104" preserveAspectRatio="none">
        <line x1="22" y1="0" x2="0" y2="104" />
        <line x1="132" y1="0" x2="110" y2="104" />
      </svg>
      <div className="mp-icon"><img src="/brand/munago-mecanica-icon.svg" alt="" width={52} height={52} /></div>
    </div>
  </div>
);

/** Mesma marcação do preload do index.html (estilos .mp-* no head): a troca HTML → React não pisca. */
export const Preloader: React.FC<{ caption?: string }> = ({ caption = 'Carregando' }) => (
  <div className="mp-root" role="status" aria-label={caption}>
    {/* Sem a entrada (mpIn): o preload do HTML já estava na tela. */}
    <div className="mp-stage" style={{ animation: 'none' }}>
      <img className="mp-mark" src="/brand/munago-mecanica-icon.svg" alt="" width={64} height={64} />
      <div className="mp-word">Munago <span>Mecânica</span></div>
      <div className="mp-track"><span /></div>
    </div>
  </div>
);
