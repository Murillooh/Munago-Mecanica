import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, LogOut, RefreshCw } from 'lucide-react';
import { AUTH_BG, AUTH_CHARACTER_URL, AUTH_PANEL_GRID } from './auth/authStyles';
import { AuthFeatures } from './auth/AuthFeatures';
import { Logo3D } from './Preloader';

const POLL_MS = 15_000;

const STEPS = [
  { label: 'Conta criada', detail: 'Seu acesso já está cadastrado.', state: 'done' },
  { label: 'Aguardando entrar numa mecânica', detail: 'Um administrador vai vincular você a uma oficina.', state: 'current' },
  { label: 'Acesso liberado', detail: 'Você entra direto no sistema, sem recarregar.', state: 'todo' },
] as const;

const SLANT = 64;
const ease = [0.22, 1, 0.36, 1] as const;
const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease, delay: 0.15 + i * 0.08 },
});

/** Topo da tela: só a logo 3D girando (mesma do preload). */
const WaitingEmblem: React.FC = () => (
  <div className="mb-6 -ml-2 flex h-28 w-36 items-center justify-start">
    <Logo3D />
  </div>
);

/** Espera de aprovação: mesmo visual da tela de login, conferindo sozinha se o acesso já foi liberado. */
export const PendingApproval: React.FC<{
  storeName: string;
  email?: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}> = ({ storeName, email, onRefresh, onLogout }) => {
  const [checking, setChecking] = useState(false);
  const [nextAt, setNextAt] = useState(() => Date.now() + POLL_MS);
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      // Se o admin já aprovou, o perfil muda e o App sai desta tela sozinho.
      await onRefresh();
    } catch {
      // Falha de rede: tenta de novo no próximo ciclo.
    } finally {
      busy.current = false;
      setChecking(false);
      setNextAt(Date.now() + POLL_MS);
    }
  }, [onRefresh]);

  // Um relógio de 1 s move a contagem e dispara a verificação quando ela zera.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener('focus', check);
    return () => { clearInterval(id); window.removeEventListener('focus', check); };
  }, [check]);
  useEffect(() => {
    if (now >= nextAt) check();
  }, [now, nextAt, check]);

  const secondsLeft = Math.max(0, Math.ceil((nextAt - now) / 1000));

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 relative overflow-hidden font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={AUTH_BG.glow} />
        <div className="absolute inset-0" style={AUTH_BG.grid} />
        <div className="absolute inset-0" style={AUTH_BG.vignette} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="w-full max-w-6xl lg:min-h-[680px] flex flex-col lg:flex-row items-stretch relative z-10 bg-zinc-900 border border-white/10 rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      >
        {/* Painel azul com a mesma divisa diagonal brilhante do login */}
        <div
          className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-16 flex-col justify-between relative overflow-hidden"
          style={{ clipPath: `polygon(0 0, calc(100% - ${SLANT}px) 0, 100% 100%, 0 100%)` }}
        >
          <div aria-hidden="true" className="absolute inset-0" style={AUTH_PANEL_GRID} />
          <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-20 h-full" style={{ width: SLANT }} viewBox={`0 0 ${SLANT} 100`} preserveAspectRatio="none">
            <line
              x1={0} y1={0} x2={SLANT} y2={100}
              stroke="#dbeafe" strokeWidth={4} vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.95)) drop-shadow(0 0 14px rgba(59,130,246,0.7))' }}
            />
          </svg>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <img src="/brand/munago-mecanica-icon.svg" alt="" width={48} height={48} className="h-12 w-12 rounded-xl shadow-xl ring-1 ring-white/20" />
              <span className="font-black text-3xl tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">Munago <span className="text-amber-300">Mecânica</span></span>
            </div>
            <h2 className="text-5xl font-black text-white leading-[1.1] mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              Quase lá! <br />
              <span className="text-blue-200">Falta só liberar.</span>
            </h2>
            <p className="text-blue-50 text-lg font-medium max-w-sm leading-relaxed opacity-80">
              Sua conta já existe. Assim que um administrador aprovar, você entra direto no sistema.
            </p>
          </div>

          <AuthFeatures />

          <motion.img
            src={AUTH_CHARACTER_URL}
            alt=""
            className="absolute bottom-[-24px] right-[-8px] w-[220px] h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] pointer-events-none"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Lado direito: status da aprovação */}
        <div className="w-full lg:w-[460px] flex flex-col justify-center p-6 sm:p-12 lg:p-14">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/brand/munago-mecanica-icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="font-black text-xl tracking-tight text-white">Munago <span className="text-amber-300">Mecânica</span></span>
          </div>

          <motion.div {...rise(0)}><WaitingEmblem /></motion.div>

          <motion.h1 {...rise(1)} className="text-3xl sm:text-4xl font-black tracking-tight text-white">Acesso em análise</motion.h1>
          <motion.p {...rise(2)} className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-md">
            Um administrador da <span className="font-semibold text-white">{storeName}</span> vai colocar você na sua mecânica e liberar o acesso em breve.
          </motion.p>
          {email && (
            <motion.p {...rise(3)} className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 font-mono text-xs text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              {email}
            </motion.p>
          )}

          {/* Linha do tempo: trilho verde até a etapa atual, luz descendo até a próxima */}
          <motion.ol {...rise(4)} className="relative mt-8 space-y-5" aria-label="Andamento da aprovação">
            <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(50%-1.75rem)] w-0.5 rounded-full bg-emerald-500/70" />
            <span aria-hidden="true" className="absolute left-[13px] top-1/2 bottom-7 w-0.5 overflow-hidden rounded-full bg-zinc-800">
              <motion.span
                className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-blue-300 to-transparent"
                animate={{ top: ['-2rem', '100%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
            {STEPS.map((s) => (
              <li key={s.label} className="relative flex items-start gap-4" aria-current={s.state === 'current' ? 'step' : undefined}>
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-zinc-900 ${
                    s.state === 'done' ? 'border-emerald-500 bg-emerald-500 text-white'
                      : s.state === 'current' ? 'border-blue-400' : 'border-zinc-700'
                  }`}
                >
                  {s.state === 'done' && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  {s.state === 'current' && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-blue-400/30 motion-safe:animate-ping" aria-hidden="true" />
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-400" aria-hidden="true" />
                    </>
                  )}
                </span>
                <span className="pt-0.5">
                  <span className={`block text-sm ${s.state === 'current' ? 'font-bold text-blue-300' : s.state === 'done' ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-500'}`}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{s.detail}</span>
                </span>
              </li>
            ))}
          </motion.ol>

          {/* Contagem até a próxima verificação automática */}
          <motion.div {...rise(5)} className="mt-8 max-w-md" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{checking ? 'Verificando seu acesso…' : 'Próxima verificação automática'}</span>
              {!checking && <span className="font-mono tabular-nums text-zinc-400">{secondsLeft}s</span>}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
              {checking ? (
                <motion.div
                  className="h-full w-1/3 rounded-full bg-blue-500"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  key={nextAt}
                  className="h-full origin-left rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: Math.max(0, nextAt - Date.now()) / 1000, ease: 'linear' }}
                />
              )}
            </div>
          </motion.div>

          <motion.div {...rise(6)} className="mt-5 flex gap-3 max-w-md">
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30 transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 cursor-pointer"
            >
              <RefreshCw size={16} className={checking ? 'animate-spin' : ''} aria-hidden="true" />
              {checking ? 'Verificando…' : 'Verificar agora'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800/60 px-5 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 cursor-pointer"
            >
              <LogOut size={16} aria-hidden="true" /> Sair
            </button>
          </motion.div>
        </div>
      </motion.div>

      <div className="relative z-10 flex w-full justify-center">
        <div className="flex flex-col items-center w-full max-w-3xl gap-1.5 px-4 sm:px-6 py-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 text-center text-white/70 text-[10px] sm:text-[11px] font-semibold tracking-[0.15em] sm:tracking-[0.3em] uppercase">
          <span className="text-white">Munago Desenvolvedora de Software</span>
          <span>&copy; 2026 • Gestão Operacional • Versão 1.0.1</span>
        </div>
      </div>
    </div>
  );
};
