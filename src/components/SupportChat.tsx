import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { macZoom } from '../lib/motion';
import { ArrowUp, BatteryFull, ChevronLeft, MessageCircleQuestion, RotateCcw, Signal, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authFetch } from '../lib/api';
import { AUTH_CHARACTER_URL } from './auth/authStyles';

type Msg = { role: 'user' | 'model'; text: string; error?: boolean };

const STORAGE_KEY = 'munago_support_chat';

/** Sugestões de pergunta conforme a tela em que a pessoa está. */
const SUGGESTIONS: Record<string, string[]> = {
  dashboard: ['O que significa "risco de ruptura"?', 'Como uso o Modo Monitor na TV?', 'Como gero o relatório em PDF?'],
  inventory: ['Como cadastro uma peça nova?', 'Como registro a entrada de peças?', 'Como exporto o estoque para Excel?'],
  os: ['Como abro uma ordem de serviço?', 'Como funciona o repasse no pagamento?', 'Posso mudar as peças de uma OS?'],
  transactions: ['Como filtro só as saídas?', 'Como exporto as movimentações?'],
  alerts: ['Por que recebo alertas de estoque?', 'Como marco todos como lidos?'],
  users: ['Como aprovo um novo usuário?', 'Qual a diferença entre os perfis?'],
  settings: ['Como conecto o Google Drive?', 'Como mudo o percentual do repasse?'],
  ai: ['Qual a diferença entre você e o Assistente IA?'],
};
const DEFAULT_SUGGESTIONS = ['Como abro uma ordem de serviço?', 'Como registro a entrada de peças?', 'Como instalo o app no celular?'];

/** Markdown mínimo e seguro (negrito, listas, quebras de linha), montado como elementos React. */
function renderRich(text: string) {
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${key}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>
        : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>,
    );
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`my-1.5 space-y-1 pl-5 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>
        {list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };
  text.split('\n').forEach((raw, idx) => {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ol || ul) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ol ?? ul)![1]);
      return;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p${idx}`} className="my-1 first:mt-0 last:mb-0">{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return blocks;
}

const TypingDots = () => (
  <span className="inline-flex items-center gap-1" aria-label="Ana está digitando">
    {[0, 1, 2].map((i) => (
      <span key={i} className="h-1.5 w-1.5 rounded-full bg-zinc-400 motion-safe:animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
    ))}
  </span>
);

const AnaAvatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white ${size === 'md' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-[11px]'}`}
    aria-hidden="true"
  >
    A
    {size === 'md' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-50 bg-emerald-500 dark:border-zinc-900" />}
  </span>
);

export const SupportChat: React.FC = () => {
  const { profile, activeTab, isMonitorMode } = useApp();
  const firstName = (profile?.name ?? '').trim().split(/\s+/)[0];
  const greeting = `Oi${firstName ? `, ${firstName}` : ''}! Eu sou a Ana, assistente virtual da Munago. Pode me perguntar qualquer coisa sobre como usar o sistema, que eu te explico passo a passo.`;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as Msg[]; } catch { return []; }
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* armazenamento indisponível */ }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const suggestions = useMemo(() => SUGGESTIONS[activeTab] ?? DEFAULT_SUGGESTIONS, [activeTab]);

  if (isMonitorMode || !profile) return null;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', text: question }];
    setMessages([...history, { role: 'model', text: '' }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = '';
    const update = (patch: Partial<Msg>) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    try {
      const res = await authFetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, text: t }) => ({ role, text: t.slice(0, 2000) })), screen: activeTab }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Não consegui responder agora.');
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Não consegui ler a resposta.');
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') { done = true; break; }
          let parsed: { text?: string; error?: string };
          try { parsed = JSON.parse(data); } catch { continue; }
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) { answer += parsed.text; update({ text: answer }); }
        }
      }
      if (!answer.trim()) throw new Error('Fiquei sem resposta agora. Pode perguntar de novo?');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      update({ text: err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.', error: true });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => prev.slice(0, prev.map((m) => m.role).lastIndexOf('user')));
    void send(lastUser.text);
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
  };

  const showSuggestions = messages.length === 0;
  const clock = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Botão flutuante: no celular fica acima do menu inferior e da barra de gestos */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            aria-label="Abrir chat de ajuda com a Ana"
            title="Precisa de ajuda? Fale com a Ana"
            style={{ transformOrigin: 'bottom right' }}
            className="group fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6 z-[60] rounded-[15px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 cursor-pointer"
          >
            {/* Balão de mensagem acima do celular, até a primeira conversa */}
            {messages.length === 0 && (
              <span className="absolute bottom-full right-0 mb-2.5 whitespace-nowrap rounded-[1.1rem] rounded-br-[0.35rem] bg-white px-3 py-2 text-left text-xs font-medium text-zinc-800 shadow-lg shadow-black/15 ring-1 ring-zinc-900/5 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10" aria-hidden="true">
                Oi! Precisa de ajuda?
                <span className="block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">Fale com a Ana</span>
              </span>
            )}
            {/* Mini iPhone: moldura, ilha e o boneco das telas de login como papel de parede */}
            <span className="relative flex h-[68px] w-11 rounded-[15px] bg-zinc-900 p-[3px] shadow-lg shadow-blue-900/30 ring-1 ring-white/15 transition-transform group-hover:-translate-y-0.5 group-hover:scale-105">
              <span className="relative flex-1 overflow-hidden rounded-[12px] bg-gradient-to-br from-blue-500 to-indigo-600">
                <img src={AUTH_CHARACTER_URL} alt="" className="absolute inset-x-0 top-1.5 h-full w-full object-cover object-top" referrerPolicy="no-referrer" />
                <span className="absolute left-1/2 top-1 h-1 w-3.5 -translate-x-1/2 rounded-full bg-black" />
                <span className="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-white/70" />
              </span>
              {/* Selo de notificação com o ícone do chat */}
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow ring-2 ring-white dark:ring-zinc-900">
                <MessageCircleQuestion size={12} aria-hidden="true" />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Chat de ajuda com a Ana"
            // Nasce do botão redondo (canto inferior direito) e cresce, como abrir um app no macOS.
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.1 }}
            transition={macZoom}
            style={{ transformOrigin: 'bottom right' }}
            // No celular ocupa a tela; do sm para cima vira um iPhone (moldura, ilha, barra de status).
            className="fixed z-[70] inset-0 flex sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(720px,calc(100dvh-3rem))] sm:w-[360px] sm:rounded-[3.25rem] sm:bg-zinc-900 sm:p-[11px] sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.14),0_0_0_1px_rgba(0,0,0,0.6)]"
          >
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:bg-black sm:rounded-[2.6rem] sm:pt-0 sm:pb-0">
              {/* Barra de status + Dynamic Island (só na moldura; no celular real o sistema já mostra) */}
              <div className="relative hidden h-11 shrink-0 items-center justify-between px-7 text-[13px] font-semibold text-zinc-900 dark:text-white sm:flex" aria-hidden="true">
                <span className="tabular-nums">{clock}</span>
                <span className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
                <span className="flex items-center gap-1">
                  <Signal size={14} strokeWidth={2.5} />
                  <Wifi size={14} strokeWidth={2.5} />
                  <BatteryFull size={20} strokeWidth={2} />
                </span>
              </div>

              {/* Cabeçalho estilo Mensagens */}
              <header className="relative flex shrink-0 flex-col items-center border-b border-zinc-200/80 bg-zinc-50/80 px-3 pb-2 pt-1 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat" className="absolute left-1.5 top-1/2 flex -translate-y-1/2 items-center rounded-lg px-1 py-2 text-[15px] text-blue-500 transition-opacity hover:opacity-70 cursor-pointer">
                  <ChevronLeft size={24} aria-hidden="true" />
                  <span className="-ml-1">Fechar</span>
                </button>
                {messages.length > 0 && (
                  <button type="button" onClick={reset} title="Começar nova conversa" aria-label="Começar nova conversa" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-blue-500 transition-opacity hover:opacity-70 cursor-pointer">
                    <RotateCcw size={18} aria-hidden="true" />
                  </button>
                )}
                <AnaAvatar size="md" />
                <p className="mt-1 text-[11px] font-medium text-zinc-900 dark:text-white">Ana</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Assistente virtual · responde na hora</p>
              </header>

              {/* Conversa */}
              <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3" aria-live="polite">
                <p className="pb-1 text-center text-[11px] font-medium text-zinc-400">Hoje {clock}</p>
                <div className="flex">
                  <div className="max-w-[78%] rounded-[1.15rem] rounded-bl-[0.35rem] bg-zinc-200/80 px-3 py-2 text-[14px] leading-snug text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                    {greeting}
                  </div>
                </div>

                {messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[78%] whitespace-pre-wrap rounded-[1.15rem] rounded-br-[0.35rem] bg-blue-500 px-3 py-2 text-[14px] leading-snug text-white">{m.text}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex">
                      <div className={`max-w-[78%] rounded-[1.15rem] rounded-bl-[0.35rem] px-3 py-2 text-[14px] leading-snug ${m.error ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300' : 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'}`}>
                        {m.text ? renderRich(m.text) : <TypingDots />}
                        {m.error && (
                          <button type="button" onClick={retry} className="mt-2 block text-xs font-semibold underline underline-offset-2 cursor-pointer">
                            Tentar de novo
                          </button>
                        )}
                      </div>
                    </div>
                  ),
                )}

                {showSuggestions && (
                  <div className="flex flex-col items-end gap-1.5 pt-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="max-w-[85%] rounded-[1.15rem] border border-blue-500/40 px-3 py-1.5 text-right text-[13px] font-medium text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400 cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Caixa de mensagem */}
              <form
                onSubmit={(e) => { e.preventDefault(); void send(input); }}
                className="shrink-0 bg-zinc-50/80 px-3 pb-2 pt-2 backdrop-blur-xl dark:bg-zinc-900/80"
              >
                <div className="flex items-end gap-1.5 rounded-[1.25rem] border border-zinc-300 bg-white py-1 pl-3.5 pr-1 focus-within:border-blue-500 dark:border-zinc-700 dark:bg-black">
                  <label htmlFor="support-input" className="sr-only">Escreva sua dúvida</label>
                  <textarea
                    id="support-input"
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={2000}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                    placeholder="Mensagem"
                    className="max-h-28 min-h-[1.5rem] flex-1 resize-none self-center bg-transparent py-1 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    aria-label="Enviar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-opacity hover:bg-blue-600 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp size={16} strokeWidth={2.75} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-zinc-400">A Ana é uma IA e pode errar. Para análises do estoque, use o Assistente IA.</p>
                {/* Barra de gestos do iPhone */}
                <span className="mx-auto mt-2 hidden h-[5px] w-28 rounded-full bg-zinc-900 dark:bg-white sm:block" aria-hidden="true" />
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
};
