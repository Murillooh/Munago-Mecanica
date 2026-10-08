import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Hourglass, LogOut, RefreshCw } from 'lucide-react';
import { AUTH_BG, AUTH_CHARACTER_URL, AUTH_PANEL_GRID } from './auth/authStyles';
import { AuthFeatures } from './auth/AuthFeatures';

const POLL_MS = 15_000;

const STEPS = [
  { label: 'Conta criada', state: 'done' },
  { label: 'Aguardando entrar numa mecânica', state: 'current' },
  { label: 'Acesso liberado', state: 'todo' },
] as const;

/** Espera de aprovação: mesmo visual da tela de login, conferindo sozinha se o acesso já foi liberado. */
export const PendingApproval: React.FC<{
  storeName: string;
  email?: string | null;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}> = ({ storeName, email, onRefresh, onLogout }) => {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const busy = useRef(false);

  const check = async () => {
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
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    const id = setInterval(check, POLL_MS);
    window.addEventListener('focus', check);
    return () => { clearInterval(id); window.removeEventListener('focus', check); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        className="w-full max-w-6xl lg:min-h-[620px] flex flex-col lg:flex-row items-stretch relative z-10 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      >
        {/* Painel azul, igual ao do login */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-16 flex-col justify-between relative overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0" style={AUTH_PANEL_GRID} />

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
            className="absolute bottom-[-50px] right-[-60px] w-[300px] h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)] pointer-events-none"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Lado direito: status da aprovação */}
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-16">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/brand/munago-mecanica-icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
            <span className="font-black text-xl tracking-tight text-white">Munago <span className="text-amber-300">Mecânica</span></span>
          </div>

          <div className="relative mb-8 h-16 w-16">
            <span className="absolute inset-0 rounded-2xl bg-amber-500/20 motion-safe:animate-ping" aria-hidden="true" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-400">
              <Hourglass size={28} aria-hidden="true" />
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Acesso em análise</h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed max-w-md">
            Um administrador da <span className="font-semibold text-white">{storeName}</span> vai colocar você na sua mecânica e liberar o acesso em breve.
          </p>
          {email && (
            <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300">
              {email}
            </p>
          )}

          {/* Etapas */}
          <ol className="mt-8 space-y-3" aria-label="Andamento da aprovação">
            {STEPS.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm" aria-current={s.state === 'current' ? 'step' : undefined}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    s.state === 'done'
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : s.state === 'current'
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-zinc-700'
                  }`}
                >
                  {s.state === 'done' && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  {s.state === 'current' && <span className="h-2.5 w-2.5 rounded-full bg-amber-400 motion-safe:animate-pulse" aria-hidden="true" />}
                </span>
                <span className={s.state === 'current' ? 'font-bold text-amber-300' : s.state === 'done' ? 'font-medium text-zinc-200' : 'text-zinc-500'}>
                  {s.label}
                  {s.state === 'current' && <span className="ml-2 inline-flex gap-0.5 align-middle" aria-hidden="true">
                    {[0, 1, 2].map(i => <span key={i} className="h-1 w-1 rounded-full bg-amber-300 motion-safe:animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
                  </span>}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-xs text-zinc-500" aria-live="polite">
            Esta tela confere sozinha a cada 15 segundos.
            {lastCheck && <> Última verificação às {lastCheck.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</>}
          </p>

          <div className="mt-4 flex gap-3 max-w-md">
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-700 disabled:opacity-70 cursor-pointer"
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
          </div>
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
