import { useEffect, useState } from 'react';

/**
 * Detecta deploy novo: o index.html publicado passa a apontar para outro bundle (/assets/index-HASH.js).
 * Em dev não há hash de build, então nunca avisa.
 */
export function useNewVersion(intervalMs = 60_000) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src');
    if (!current || ready) return;
    const check = async () => {
      try {
        const res = await fetch('/', { cache: 'no-store' });
        const html = res.ok ? await res.text() : '';
        // Só conta como versão nova se a página veio inteira (com bundle) e o bundle mudou
        if (html.includes('/assets/') && !html.includes(current)) setReady(true);
      } catch { /* offline: tenta de novo no próximo ciclo */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const id = window.setInterval(check, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [intervalMs, ready]);

  return ready;
}
