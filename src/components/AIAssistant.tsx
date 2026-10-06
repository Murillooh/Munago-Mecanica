import React, { useState, useRef, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { apiDelete, apiGet, apiPost, authFetch, hydrateDates, type AppTimestamp } from "../lib/api";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles, 
  Search, 
  MapPin, 
  TrendingUp, 
  AlertTriangle,
  Info,
  ExternalLink,
  History,
  MessageSquare,
  Clock,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'search' | 'maps';
  groundingMetadata?: any;
}

interface SavedSearch {
  id: string;
  query: string;
  response: string;
  timestamp: AppTimestamp;
  metadata?: any;
}

const AIAssistant = () => {
  const { user, products, categories, serviceOrders, profile, isEditor } = useApp();
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: `Olá ${profile?.name || 'usuário'}! Sou seu assistente de inteligência. Como posso ajudar você hoje? ${isEditor ? 'Posso analisar seu estoque, buscar preços de mercado ou encontrar fornecedores próximos.' : 'Posso ajudar você a analisar as ordens de serviço ou buscar informações de mercado.'}` 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // Histórico de pesquisas do usuário (API)
  const loadHistory = async () => {
    try {
      setHistory((await apiGet<SavedSearch[]>('/ai-searches')).map(hydrateDates));
    } catch (error) {
      console.error('Error loading AI history:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadHistory();
  }, [user?.uid]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input;
    const userMessage: Message = { role: 'user', content: userQuery };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Context for the AI
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
        date: os.createdAt && typeof os.createdAt.toDate === 'function' 
          ? os.createdAt.toDate().toLocaleDateString('pt-BR') 
          : 'N/A'
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: userQuery,
          systemInstruction,
          config: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const serverError = errorData.error || "Erro ao conectar com o serviço de IA.";
        throw new Error(serverError);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("A resposta não pôde ser processada.");

      let fullResponse = "";
      const aiMessage: Message = { 
        role: 'assistant', 
        content: "",
        type: 'text'
      };

      setMessages(prev => [...prev, aiMessage]);

      const decoder = new TextDecoder();
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') {
              finished = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              
              if (data.text) {
                fullResponse += data.text;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content: fullResponse,
                    groundingMetadata: data.groundingMetadata || newMessages[newMessages.length - 1].groundingMetadata
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Error parsing chunk:", e);
            }
          }
        }
      }

      // Salva no histórico após o stream terminar
      if (user && fullResponse) {
        await apiPost('/ai-searches', { query: userQuery, response: fullResponse });
        loadHistory();
      }

    } catch (error: any) {
      console.error('AI Error:', error);
      let errorMessage = error.message || "Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.";
      
      if (error.message?.includes("GEMINI_API_KEY")) {
        errorMessage = "Erro de configuração: Chave de API do Gemini não foi encontrada ou está com valor padrão. Por favor, configure GEMINI_API_KEY nas configurações (Secrets) do projeto.";
      } else if (error.message?.includes("API key") || error.message?.includes("403") || error.message?.includes("401")) {
        errorMessage = "Erro de autenticação: A chave de API fornecida é inválida ou não tem permissão para este modelo.";
      }
        
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGrounding = (metadata: any) => {
    if (!metadata) return null;

    const chunks = metadata.groundingChunks;
    if (!chunks || chunks.length === 0) return null;

    return (
      <div className="mt-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Info size={10} /> Fontes de Informação
        </p>
        <div className="flex flex-wrap gap-2">
          {chunks.map((chunk: any, i: number) => {
            if (chunk.web) {
              return (
                <a 
                  key={i} 
                  href={chunk.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all border border-blue-100 dark:border-blue-900/40"
                >
                  <Search size={10} />
                  {chunk.web.title || 'Ver Fonte'}
                  <ExternalLink size={8} />
                </a>
              );
            }
            if (chunk.maps) {
              return (
                <a 
                  key={i} 
                  href={chunk.maps.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-[10px] font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-all border border-green-100 dark:border-green-900/40"
                >
                  <MapPin size={10} />
                  {chunk.maps.title || 'Ver no Maps'}
                  <ExternalLink size={8} />
                </a>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-120px)] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 lg:p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20">
            <Sparkles size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-white">Assistente de Mercado</h2>
            <p className="text-[10px] lg:text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <TrendingUp size={10} className="lg:w-3 lg:h-3" /> Inteligência com Grounding (Search & Maps)
            </p>
          </div>
        </div>
        
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm dark:shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <MessageSquare size={14} className="lg:w-4 lg:h-4" />
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm dark:shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <History size={14} className="lg:w-4 lg:h-4" />
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
          >
            {messages.map((msg, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' 
                      : 'bg-blue-600 text-white'
                  }`}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={`p-4 rounded-3xl ${
                    msg.role === 'user' 
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-tr-none' 
                      : 'bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-tl-none shadow-sm'
                  }`}>
                    <div className="prose dark:prose-invert prose-sm max-w-none">
                      {msg.content.split('\n').map((line, j) => (
                        <p key={j} className="mb-2 last:mb-0">{line}</p>
                      ))}
                    </div>
                    {renderGrounding(msg.groundingMetadata)}
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={20} />
                  </div>
                  <div className="p-4 rounded-3xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-tl-none shadow-sm flex items-center gap-2 dark:shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Analisando mercado...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input */}
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm focus-within:ring-2 focus-within:ring-blue-600/20 focus-within:border-blue-600 transition-all dark:focus-within:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <input 
                type="text" 
                placeholder="Pergunte sobre preços, fornecedores ou seu estoque..." 
                className="flex-1 px-4 py-2 bg-transparent outline-none text-zinc-900 dark:text-white text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600 shadow-lg shadow-blue-600/20 dark:shadow-blue-500/40"
              >
                <Send size={20} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 flex-wrap">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 uppercase tracking-widest font-bold">
                <Sparkles size={10} /> Sugestões:
              </p>
              <button 
                onClick={() => setInput("Quais os preços médios de pastilhas de freio no mercado?")}
                className="text-[10px] font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors uppercase tracking-wider"
              >
                Preços de Peças
              </button>
              <button 
                onClick={() => setInput("Encontre fornecedores de pneus em São Paulo")}
                className="text-[10px] font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors uppercase tracking-wider"
              >
                Fornecedores Próximos
              </button>
              <button 
                onClick={() => setInput("Quais itens do meu estoque estão com nível crítico?")}
                className="text-[10px] font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors uppercase tracking-wider"
              >
                Análise de Estoque
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-4">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-full">
                <History size={48} strokeWidth={1} />
              </div>
              <div className="text-center">
                <p className="font-bold text-zinc-900 dark:text-white">Nenhuma pesquisa salva</p>
                <p className="text-sm">Suas interações com o assistente aparecerão aqui.</p>
              </div>
              <button 
                onClick={() => setActiveTab('chat')}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
              >
                Começar a Conversar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {history.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group relative"
                >
                  <AnimatePresence>
                    {deleteConfirmId === item.id && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-4 text-center"
                      >
                        <p className="text-sm font-bold text-zinc-900 dark:text-white mb-4">Excluir esta pesquisa?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={async () => {
                              try {
                                await apiDelete(`/ai-searches/${item.id}`);
                                setHistory(prev => prev.filter(h => h.id !== item.id));
                                toast.success('Pesquisa excluída com sucesso!');
                              } catch (err) {
                                toast.error('Erro ao excluir pesquisa.');
                              } finally {
                                setDeleteConfirmId(null);
                              }
                            }}
                            className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                          >
                            Excluir
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Clock size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {item.timestamp && typeof item.timestamp.toDate === 'function' 
                          ? item.timestamp.toDate().toLocaleString('pt-BR') 
                          : 'Recentemente'}
                      </span>
                    </div>
                    <button 
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2">
                        "{item.query}"
                      </p>
                    </div>
                    <div className="prose dark:prose-invert prose-xs line-clamp-3 text-zinc-600 dark:text-zinc-400">
                      {item.response}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-700 flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setMessages([
                          { role: 'user', content: item.query },
                          { role: 'assistant', content: item.response, groundingMetadata: item.metadata }
                        ]);
                        setActiveTab('chat');
                      }}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                    >
                      Ver Conversa Completa
                    </button>
                    {renderGrounding(item.metadata)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
