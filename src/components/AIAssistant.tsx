import React, { useState, useRef, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { apiDelete, apiGet, apiPost, authFetch, hydrateDates, type AppTimestamp } from "../lib/api";
import { parseDate } from './dashboard/utils';
import {
  Send,
  Loader2,
  Sparkles,
  Search,
  MapPin,
  ExternalLink,
  History,
  MessageSquare,
  Trash2,
  Plus,
  Package,
  Truck,
  TrendingUp,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'search' | 'maps';
  groundingMetadata?: any;
  isError?: boolean;
}

interface SavedSearch {
  id: string;
  query: string;
  response: string;
  timestamp: AppTimestamp;
  metadata?: any;
}

const SUGGESTIONS = [
  { icon: Package, title: 'Estoque crítico', prompt: 'Quais itens do meu estoque estão com nível crítico e o que devo repor primeiro?' },
  { icon: TrendingUp, title: 'Preços de mercado', prompt: 'Quais os preços médios de pastilhas de freio no mercado hoje?' },
  { icon: Truck, title: 'Fornecedores', prompt: 'Encontre fornecedores de pneus em São Paulo.' },
  { icon: FileText, title: 'Ordens de serviço', prompt: 'Resuma as ordens de serviço em aberto e o valor total delas.' },
];

/** **negrito** dentro de uma linha, sem HTML cru. */
const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );

/** Markdown simples que o Gemini costuma devolver: títulos, listas e parágrafos. */
const FormattedText: React.FC<{ content: string }> = ({ content }) => {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
        {list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
      </Tag>
    );
    list = null;
  };
  content.split('\n').forEach(raw => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet || numbered)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    if (heading) {
      blocks.push(<p key={blocks.length} className="font-semibold text-zinc-900 dark:text-white">{renderInline(heading[1])}</p>);
    } else {
      blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
    }
  });
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
};

const Sources: React.FC<{ metadata: any }> = ({ metadata }) => {
  const chunks = metadata?.groundingChunks;
  if (!chunks?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chunks.map((chunk: any, i: number) => {
        const src = chunk.web || chunk.maps;
        if (!src) return null;
        const Icon = chunk.web ? Search : MapPin;
        return (
          <a
            key={i}
            href={src.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Icon size={11} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{src.title || (chunk.web ? 'Fonte' : 'Ver no Maps')}</span>
            <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
};

const relativeDate = (ts: AppTimestamp) => {
  const d = parseDate(ts);
  if (!d) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const AIAssistant = () => {
  const { user, products, serviceOrders, profile, isEditor } = useApp();
  const [mobilePane, setMobilePane] = useState<'chat' | 'history'>('chat');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Textarea cresce até ~6 linhas
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const loadHistory = async () => {
    try {
      setHistory((await apiGet<SavedSearch[]>('/ai-searches')).map(hydrateDates));
    } catch (error) {
      console.error('Error loading AI history:', error);
      toast.error('Não foi possível carregar o histórico de conversas.');
    }
  };

  useEffect(() => {
    if (!user) return;
    loadHistory();
  }, [user?.uid]);

  const newConversation = () => {
    setMessages([]);
    setActiveHistoryId(null);
    setMobilePane('chat');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async (text?: string) => {
    const userQuery = (text ?? input).trim();
    if (!userQuery || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: userQuery }, { role: 'assistant', content: '', type: 'text' }]);
    setInput('');
    setActiveHistoryId(null);
    setIsLoading(true);

    const updateLast = (patch: Partial<Message>) =>
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    try {
      const inventoryContext = isEditor ? (products || []).map(p => ({
        name: p.name,
        sku: p.sku || 'N/A',
        quantity: p.quantity,
        minQuantity: p.minQuantity,
        price: p.price || 0,
        category: p.category || 'N/A'
      })) : [];

      const osContext = (serviceOrders || []).map(os => ({
        id: os.id,
        client: os.customerName || 'N/A',
        vehicle: os.vehiclePlate || 'N/A',
        status: os.status,
        total: os.totalAmount || 0,
        date: parseDate(os.createdAt)?.toLocaleDateString('pt-BR') ?? 'N/A'
      }));

      const systemInstruction = `
        Você é um assistente especializado em gestão de oficina automotiva e mercado de autopeças.
        ${isEditor ? `Contexto do estoque: ${JSON.stringify(inventoryContext.slice(0, 25))}.` : 'Você não tem acesso direto ao estoque.'}
        Contexto das ordens de serviço: ${JSON.stringify(osContext.slice(0, 15))}.

        Capacidades:
        1. Analisar dados internos (estoque/OS) para dar insights.
        2. Buscar preços e fornecedores reais no Brasil usando Google Search.

        Sempre responda em Português do Brasil. Seja técnico mas acessível.
      `;

      const response = await authFetch('/api/gemini/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: userQuery,
          systemInstruction,
          config: { maxOutputTokens: 1000, temperature: 0.7 }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao conectar com o serviço de IA.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('A resposta não pôde ser processada.');

      let fullResponse = '';
      let metadata: any;
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        // Um evento SSE pode chegar partido entre duas leituras: guarda a última linha incompleta.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.substring(6);
          if (dataStr === '[DONE]') { finished = true; break; }
          let data: any;
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            console.error('Error parsing chunk:', e);
            continue;
          }
          // Erro enviado pelo servidor no meio do stream: precisa chegar ao usuário.
          if (data.error) throw new Error(data.error);
          if (data.text) {
            fullResponse += data.text;
            metadata = data.groundingMetadata || metadata;
            updateLast({ content: fullResponse, groundingMetadata: metadata });
          }
        }
      }

      if (!fullResponse) throw new Error('A IA não retornou resposta. Tente reformular a pergunta.');

      if (user) {
        try {
          await apiPost('/ai-searches', { query: userQuery, response: fullResponse });
          loadHistory();
        } catch (err) {
          console.error('Error saving AI search:', err);
        }
      }
    } catch (error: any) {
      console.error('AI Error:', error);
      let errorMessage = error.message || 'Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.';
      if (error.message?.includes('GEMINI_API_KEY')) {
        errorMessage = 'Erro de configuração: a chave de API do Gemini não foi encontrada. Configure GEMINI_API_KEY no servidor.';
      } else if (error.message?.includes('API key') || error.message?.includes('403') || error.message?.includes('401')) {
        errorMessage = 'Erro de autenticação: a chave de API é inválida ou não tem permissão para este modelo.';
      }
      updateLast({ content: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const openHistory = (item: SavedSearch) => {
    setMessages([
      { role: 'user', content: item.query },
      { role: 'assistant', content: item.response, groundingMetadata: item.metadata }
    ]);
    setActiveHistoryId(item.id);
    setMobilePane('chat');
  };

  const deleteHistory = async (id: string) => {
    try {
      await apiDelete(`/ai-searches/${id}`);
      setHistory(prev => prev.filter(h => h.id !== id));
      if (activeHistoryId === id) newConversation();
      toast.success('Conversa excluída.');
    } catch {
      toast.error('Erro ao excluir conversa.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredHistory = history.filter(h => !historyFilter.trim() || h.query.toLowerCase().includes(historyFilter.trim().toLowerCase()));
  const firstName = (profile?.name || '').split(' ')[0];

  return (
    // Celular: desconta o menu inferior, as margens da página e as áreas seguras do iPhone.
    <div className="w-full flex flex-col gap-4 h-[calc(100dvh-10rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] lg:h-[calc(100dvh-3rem)]">
      {/* Cabeçalho: no celular quebra em duas linhas (título em cima, controles embaixo) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Assistente IA</h1>
          <p className="hidden md:block truncate text-sm text-zinc-500 dark:text-zinc-400">Analisa seu estoque e suas OS e pesquisa preços e fornecedores na web.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="lg:hidden flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700" role="group" aria-label="Painel">
            {([['chat', 'Conversa', MessageSquare], ['history', 'Histórico', History]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMobilePane(v)}
                aria-pressed={mobilePane === v}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${mobilePane === v ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                <Icon size={13} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={newConversation}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus size={15} aria-hidden="true" /> <span className="hidden sm:inline">Nova conversa</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Histórico */}
        <aside
          aria-label="Histórico de conversas"
          className={`${mobilePane === 'history' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 shrink-0 flex-col bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden`}
        >
          <div className="shrink-0 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-white">Histórico</span>
              <span className="text-[10px] font-bold tabular-nums text-zinc-400">{history.length}</span>
            </div>
            <div className="relative">
              <label htmlFor="ai-history-search" className="sr-only">Buscar no histórico</label>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={13} aria-hidden="true" />
              <input
                id="ai-history-search"
                type="search"
                placeholder="Buscar"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredHistory.map(item => (
              <li key={item.id}>
                {deleteConfirmId === item.id ? (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">Excluir?</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 rounded-md hover:bg-white/60 dark:hover:bg-zinc-800 cursor-pointer">Não</button>
                      <button type="button" onClick={() => deleteHistory(item.id)} className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer">Excluir</button>
                    </span>
                  </div>
                ) : (
                  <div className={`group flex items-start gap-1 rounded-lg transition-colors ${activeHistoryId === item.id ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                    <button type="button" onClick={() => openHistory(item)} className="flex-1 min-w-0 text-left px-2.5 py-2 cursor-pointer">
                      <span className={`block text-xs font-medium truncate ${activeHistoryId === item.id ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'}`}>{item.query}</span>
                      <span className="block text-[10px] text-zinc-400 tabular-nums mt-0.5">{relativeDate(item.timestamp)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(item.id)}
                      aria-label={`Excluir conversa: ${item.query}`}
                      className="mt-1.5 mr-1 p-1 rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            ))}
            {filteredHistory.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {history.length === 0 ? 'Suas conversas aparecem aqui.' : 'Nada encontrado.'}
              </li>
            )}
          </ul>
        </aside>

        {/* Conversa */}
        <section
          aria-label="Conversa"
          className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 flex-col bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden`}
        >
          <div ref={scrollRef} className="flex-1 overflow-y-auto" aria-live="polite">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center">
                <span className="p-3 rounded-2xl border bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40">
                  <Sparkles size={22} aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
                  {firstName ? `Olá, ${firstName}. Como posso ajudar?` : 'Como posso ajudar?'}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
                  {isEditor ? 'Pergunte sobre seu estoque, suas ordens de serviço, preços de peças ou fornecedores.' : 'Pergunte sobre as ordens de serviço ou pesquise informações de mercado.'}
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {SUGGESTIONS.filter(s => isEditor || s.icon !== Package).map(s => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => send(s.prompt)}
                        className="flex items-start gap-3 p-3 text-left rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                      >
                        <Icon size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-zinc-900 dark:text-white">{s.title}</span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{s.prompt}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-4">
                {messages.map((msg, i) =>
                  msg.role === 'user' ? (
                    <div key={i} className="flex items-end justify-end gap-2">
                      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm leading-relaxed whitespace-pre-wrap shadow-sm shadow-blue-600/20">
                        {msg.content}
                      </div>
                      <span className="shrink-0 w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10px] font-bold flex items-center justify-center" aria-hidden="true">
                        {(profile?.name || 'Você').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div key={i} className="flex items-end gap-2">
                      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${msg.isError ? 'bg-red-100 dark:bg-red-950/60 text-red-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-600/30'}`} aria-hidden="true">
                        <Sparkles size={13} />
                      </span>
                      <div
                        className={`max-w-[80%] min-w-0 px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed shadow-xs ${
                          msg.isError
                            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
                            : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        {msg.content ? (
                          <FormattedText content={msg.content} />
                        ) : (
                          <span className="flex items-center gap-1 py-1" aria-label="A IA está pensando">
                            {[0, 150, 300].map(delay => (
                              <span key={delay} className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
                            ))}
                          </span>
                        )}
                        <Sources metadata={msg.groundingMetadata} />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Entrada */}
          <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 p-3">
            <form
              onSubmit={e => { e.preventDefault(); send(); }}
              className="max-w-5xl mx-auto flex items-end gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-1.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 transition-colors"
            >
              <label htmlFor="ai-input" className="sr-only">Mensagem para a IA</label>
              <textarea
                id="ai-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Pergunte sobre preços, fornecedores ou seu estoque…"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Enviar"
                className="shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-zinc-400">Enter envia · Shift+Enter quebra a linha · A IA pode errar; confira preços antes de comprar.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AIAssistant;
