import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { macZoom } from '../lib/motion';
import { ArrowLeft, BatteryFull, CheckCheck, MessageCircleQuestion, RotateCcw, SendHorizontal, Signal, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authFetch } from '../lib/api';

/** `at`: horário (ms) mostrado no balão, como no WhatsApp. */
type Msg = { role: 'user' | 'model'; text: string; error?: boolean; at?: number };

const hhmm = (at?: number) => (at ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

/** A saudação já abre a conversa: tira o "Oi, Fulano!" que a IA às vezes repete no começo da resposta. */
const dropGreeting = (text: string) => text.replace(/^\s*(oi|olá|ola)(?!\p{L})[^.!?\n]{0,40}[!.,]\s*/iu, '') || text;

/** Resposta longa vira vários balões, um por parágrafo (separados por linha em branco). */
const splitBubbles = (text: string) => dropGreeting(text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * Balão no estilo WhatsApp: só o primeiro de uma sequência do mesmo lado tem a "pontinha";
 * horário (e tiques, nas suas) no canto inferior direito, dentro do balão.
 */
const Bubble: React.FC<{ mine?: boolean; first: boolean; time?: string; error?: boolean; children: React.ReactNode }> = ({ mine, first, time, error, children }) => (
  <div className={`flex ${mine ? 'justify-end' : ''} ${first ? 'mt-2' : 'mt-0.5'}`}>
    <div
      // O último parágrafo fica "inline" para o horário poder dividir a linha com ele.
      className={`relative max-w-[82%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14px] leading-snug shadow-sm [&>p:has(+[data-spacer])]:inline ${
        mine
          ? `bg-blue-600 text-white ${first ? 'rounded-tr-none' : ''}`
          : `${error ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'} ${first ? 'rounded-tl-none' : ''}`
      }`}
    >
      {children}
      {time && (
        <>
          {/* Espaço reservado no fim do texto: o horário cabe na última linha ou desce sozinho */}
          <span data-spacer className={`inline-block h-3 ${mine ? 'w-16' : 'w-11'}`} aria-hidden="true" />
          <span className={`absolute bottom-1 right-2 inline-flex items-center gap-1 text-[10px] leading-none ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
            {time}
            {mine && <CheckCheck size={13} className="text-sky-200" aria-label="Lida" />}
          </span>
        </>
      )}
    </div>
  </div>
);

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

/** Retrato da Ana (imagem 3D gerada por IA, em public/). */
const ANA_IMG = '/ana.webp';

const AnaAvatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span className={`relative flex shrink-0 ${size === 'md' ? 'h-10 w-10' : 'h-7 w-7'}`} aria-hidden="true">
    <img src={ANA_IMG} alt="" className={`h-full w-full rounded-full bg-sky-200 object-cover ${size === 'md' ? 'ring-2 ring-white/40' : ''}`} />
    {size === 'md' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-blue-600 bg-emerald-400" />}
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
  const sendingRef = useRef(false);

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
    // Ref além do estado: dois cliques rápidos chegam antes do re-render e mandariam a pergunta duas vezes.
    if (!question || busy || sendingRef.current) return;
    sendingRef.current = true;
    setInput('');
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', text: question, at: Date.now() }];
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
      update({ at: Date.now() });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      update({ text: err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.', error: true });
    } finally {
      setBusy(false);
      sendingRef.current = false;
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
            {/* Mini iPhone: moldura, ilha e a Ana como papel de parede */}
            <span className="relative flex h-[68px] w-11 rounded-[15px] bg-zinc-900 p-[3px] shadow-lg shadow-blue-900/30 ring-1 ring-white/15 transition-transform group-hover:-translate-y-0.5 group-hover:scale-105">
              <span className="relative flex-1 overflow-hidden rounded-[12px] bg-gradient-to-br from-blue-500 to-indigo-600">
                <img src={ANA_IMG} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_20%]" />
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
            {/* Tela no estilo WhatsApp com as cores do sistema: cabeçalho azul, papel de parede azulado, balões com "rabinho" */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#eef2fb] pb-[env(safe-area-inset-bottom)] dark:bg-[#0b1220] sm:rounded-[2.6rem] sm:pb-0">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 pt-[env(safe-area-inset-top)] text-white sm:pt-0">
                {/* Barra de status + Dynamic Island (só na moldura; no celular real o sistema já mostra) */}
                <div className="relative hidden h-11 items-center justify-between px-7 text-[13px] font-semibold sm:flex" aria-hidden="true">
                  <span className="tabular-nums">{clock}</span>
                  <span className="absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
                  <span className="flex items-center gap-1">
                    <Signal size={14} strokeWidth={2.5} />
                    <Wifi size={14} strokeWidth={2.5} />
                    <BatteryFull size={20} strokeWidth={2} />
                  </span>
                </div>

                <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat" className="rounded-full p-1.5 transition-colors hover:bg-white/10 cursor-pointer">
                    <ArrowLeft size={22} aria-hidden="true" />
                  </button>
                  <AnaAvatar size="md" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[15px] font-semibold">Ana <span className="font-normal text-white/80">· Assistente IA</span></p>
                    <p className="truncate text-[11px] text-white/80">{busy ? 'digitando…' : 'online'}</p>
                  </div>
                  {messages.length > 0 && (
                    <button type="button" onClick={reset} title="Começar nova conversa" aria-label="Começar nova conversa" className="rounded-full p-2 transition-colors hover:bg-white/10 cursor-pointer">
                      <RotateCcw size={18} aria-hidden="true" />
                    </button>
                  )}
                </header>
              </div>

              {/* Conversa */}
              <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [background-image:radial-gradient(rgba(37,99,235,0.08)_1px,transparent_1px)] [background-size:14px_14px] dark:[background-image:radial-gradient(rgba(96,165,250,0.07)_1px,transparent_1px)]"
                aria-live="polite"
              >
                <p className="mx-auto mb-1 w-fit rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">Hoje</p>
                <p className="mx-auto mb-2 max-w-[90%] rounded-md bg-white/90 px-3 py-1.5 text-center text-[11px] leading-snug text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                  A Ana é uma IA e pode errar. Para análises do estoque, use o Assistente IA.
                </p>
                <Bubble first>{greeting}</Bubble>

                {messages.map((m, i) => {
                  // A saudação conta como mensagem da Ana: a primeira resposta continua a sequência dela.
                  const first = (i === 0 ? 'model' : messages[i - 1].role) !== m.role;
                  if (m.role === 'user') {
                    return (
                      <Bubble key={i} mine first={first} time={hhmm(m.at)}>
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </Bubble>
                    );
                  }
                  if (!m.text) return <Bubble key={i} first={first}><TypingDots /></Bubble>;
                  if (m.error) {
                    return (
                      <Bubble key={i} first={first} error>
                        {m.text}
                        <button type="button" onClick={retry} className="mt-1.5 block text-xs font-semibold underline underline-offset-2 cursor-pointer">
                          Tentar de novo
                        </button>
                      </Bubble>
                    );
                  }
                  const parts = splitBubbles(m.text);
                  return parts.map((part, j) => (
                    <Bubble key={`${i}-${j}`} first={first && j === 0} time={j === parts.length - 1 ? hhmm(m.at) : undefined}>
                      {renderRich(part)}
                    </Bubble>
                  ));
                })}

                {showSuggestions && (
                  <div className="flex flex-col items-center gap-1.5 pt-3">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="w-full max-w-[85%] rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700 cursor-pointer"
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
                className="shrink-0 px-2 pb-2 pt-1"
              >
                <div className="flex items-end gap-1.5">
                  <div className="flex min-h-[2.75rem] flex-1 items-center rounded-[1.4rem] bg-white px-4 py-1.5 shadow-sm dark:bg-slate-800">
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
                      className="max-h-28 min-h-[1.5rem] flex-1 resize-none bg-transparent py-0.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    aria-label="Enviar"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-600/30 transition-opacity hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <SendHorizontal size={19} aria-hidden="true" />
                  </button>
                </div>
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
