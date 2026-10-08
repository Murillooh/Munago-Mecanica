import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircleQuestion, RotateCcw, Send, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authFetch } from '../lib/api';

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
    {size === 'md' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />}
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
            className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 cursor-pointer"
          >
            <MessageCircleQuestion size={26} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Chat de ajuda com a Ana"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed z-[70] flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-900 inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(600px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-zinc-200 sm:pt-0 sm:pb-0 dark:sm:border-zinc-800"
          >
            {/* Cabeçalho */}
            <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <AnaAvatar size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Ana</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Assistente virtual · responde na hora</p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={reset} title="Começar nova conversa" aria-label="Começar nova conversa" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat" className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {/* Conversa */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <div className="flex items-end gap-2">
                <AnaAvatar />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                  {greeting}
                </div>
              </div>

              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">{m.text}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-end gap-2">
                    <AnaAvatar />
                    <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed ${m.error ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'}`}>
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
                <div className="flex flex-wrap gap-2 pl-9">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/60 cursor-pointer"
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
              className="border-t border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-800/60">
                <label htmlFor="support-input" className="sr-only">Escreva sua dúvida</label>
                <textarea
                  id="support-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={2000}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                  placeholder="Escreva sua dúvida…"
                  className="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Enviar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                >
                  <Send size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-zinc-400">A Ana é uma IA e pode errar. Para análises do estoque, use o Assistente IA.</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
};
