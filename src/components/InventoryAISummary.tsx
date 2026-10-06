import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Package, 
  HelpCircle,
  RefreshCw,
  Send,
  MessageSquare
} from 'lucide-react';
import { Product } from '../context/AppContext';
import { toast } from 'sonner';

interface InventoryAISummaryProps {
  products: Product[];
  categories: any[];
  isOpen: boolean;
  onClose: () => void;
}

export const InventoryAISummary: React.FC<InventoryAISummaryProps> = ({
  products,
  categories,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'list' | 'ask'>('summary');
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Ask prompt state
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);

  // Compute offline statistics of products
  const totalProducts = products.length;
  const outOfStockProducts = products.filter(p => p.quantity === 0).length;
  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.minQuantity || 5)).length;
  const normalStockProducts = products.filter(p => p.quantity > (p.minQuantity || 5)).length;
  
  const totalValuation = products.reduce((acc, p) => acc + ((p.price || 0) * p.quantity), 0);

  // Generate main AI summary
  const generateAISummary = async (force: boolean = false) => {
    if (summary && !force) return;
    setIsLoading(true);
    try {
      const compactProducts = products.map(p => ({
        sku: p.sku || 'Sem SKU',
        nome: p.name,
        categoria: p.category || 'Sem categoria',
        quantidade: p.quantity,
        min: p.minQuantity,
        preco: p.price || 0,
        status: p.status
      }));

      const systemInstruction = `
        Você é um analista inteligente de logística e controle de estoque de alto nível especializado no mercado brasileiro.
        Sua tarefa é analisar o banco de dados do estoque e fornecer um diagnóstico profissional e resumido.
        Seja objetivo, use listas e negritos para destacar pontos estratégicos.
      `;

      const prompt = `
        Por favor, forneça um relatório inteligente do estoque atualizado.
        
        Métricas Gerais de Negócio:
        - Total de Itens Diferentes (SKUs): ${totalProducts}
        - Total de Itens Esgotados: ${outOfStockProducts}
        - Total de Itens em Alerta de Estoque Baixo: ${lowStockProducts}
        - Estoque em Situação Normal: ${normalStockProducts}
        - Valor Total Estimado do Estoque: R$ ${totalValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        
        Abaixo estão todos os produtos em estoque formatados em JSON:
        ${JSON.stringify(compactProducts)}
        
        Instruções de estrutura para seu relatório:
        1. **Visão Geral Estratégica**: Faça uma brevíssima análise sobre a saúde global deste estoque (vulnerabilidades, excessos de capital imobilizado, etc.).
        2. **Produtos Críticos (Risco Imediato)**: Liste quem precisa de atenção imediata ou reposição (com SKU/Nome e a gravidade).
        3. **Sugestões de Otimização Financeira**: Comente se o capital está equilibrado ou se há pontos de desperdício/venda parada.
        4. **Sugestões de Próximos Passos de Reposição**: Recomende ações concretas de compra.
        
        Responda em Português do Brasil com linguagem clara e formatação bonita.
      `;

      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          contents: prompt,
          systemInstruction,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1500
          }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao comunicar com a IA');
      }

      const data = await response.json();
      setSummary(data.text || 'Nenhum resumo pôde ser gerado.');
    } catch (error) {
      console.error('Error generating AI Summary:', error);
      toast.error('Erro ao gerar relatório do Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate an answer to a specific user question
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim() || isAsking) return;

    setIsAsking(true);
    setAiAnswer('');
    try {
      const compactProducts = products.map(p => ({
        sku: p.sku || 'Sem SKU',
        nome: p.name,
        categoria: p.category || 'Sem categoria',
        quantidade: p.quantity,
        min: p.minQuantity,
        preco: p.price || 0,
        status: p.status
      }));

      const systemInstruction = `
        Você é um consultor estratégico de controle de estoque baseado em Inteligência Artificial.
        Você tem acesso total à lista de produtos em tempo real da oficina e responderá perguntas específicas com dados precisos.
        Seja direto, prestativo e utilize formatação em markdown para clareza.
      `;

      const prompt = `
        Pergunta do usuário: "${userQuestion}"
        
        Contexto dos produtos cadastrados:
        ${JSON.stringify(compactProducts)}
        
        Responda com precisão, apontando nomes de produtos específicos, SKUs e quantidades se necessário.
      `;

      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          contents: prompt,
          systemInstruction,
          config: {
            temperature: 0.4,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao obter resposta da Inteligência Artificial');
      }

      const data = await response.json();
      setAiAnswer(data.text || 'Não consegui obter uma resposta adequada.');
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao consultar o assistente.');
    } finally {
      setIsAsking(false);
    }
  };

  // Trigger summary generation on mount if component open
  useEffect(() => {
    if (isOpen) {
      generateAISummary();
    }
  }, [isOpen, products]);

  // Helper function to render markdown-like structures beautiful
  const renderRawMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2" />;
      
      if (trimmed.startsWith('# ')) {
        return <h1 key={i} className="text-xl font-bold text-zinc-900 dark:text-white mt-5 mb-2.5 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1">{trimmed.replace('# ', '')}</h1>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-bold text-zinc-950 dark:text-zinc-50 mt-4 mb-2 flex items-center gap-1">{trimmed.replace('## ', '')}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={i} className="text-md font-bold text-zinc-850 dark:text-zinc-200 mt-3 mb-1.5">{trimmed.replace('### ', '')}</h3>;
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        return (
          <li key={i} className="list-disc ml-5 mb-2 text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed">
            {renderFormattedLine(content)}
          </li>
        );
      }

      // Check if it's an ordered list
      if (/^\d+\.\s/.test(trimmed)) {
        const content = trimmed.replace(/^\d+\.\s/, '');
        const number = trimmed.match(/^\d+/)?.toString();
        return (
          <li key={i} className="list-decimal ml-5 mb-2 text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed">
            <span className="font-bold mr-1 text-zinc-800 dark:text-zinc-200">{number}.</span>
            {renderFormattedLine(content)}
          </li>
        );
      }

      return (
        <p key={i} className="text-sm text-zinc-650 dark:text-zinc-300 mb-2 leading-relaxed">
          {renderFormattedLine(trimmed)}
        </p>
      );
    });
  };

  const renderFormattedLine = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-bold text-zinc-900 dark:text-white bg-blue-600/5 dark:bg-blue-400/5 px-1 rounded">{part}</strong>;
      }
      return part;
    });
  };

  // Get status details for individual product
  const getStockStatus = (p: Product) => {
    if (p.quantity === 0) {
      return { 
        label: 'Esgotado', 
        color: 'text-red-500 bg-red-100/40 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
        icon: <AlertCircle size={14} className="text-red-500" />
      };
    }
    if (p.quantity <= (p.minQuantity || 5)) {
      return { 
        label: 'Baixo Estoque', 
        color: 'text-amber-600 bg-amber-100/40 dark:bg-amber-600/10 border-amber-200 dark:border-amber-600/20',
        icon: <AlertTriangle size={14} className="text-amber-500" />
      };
    }
    return { 
      label: 'Crédito Suficiente', 
      color: 'text-emerald-600 bg-emerald-100/40 dark:bg-emerald-600/10 border-emerald-200 dark:border-emerald-600/20',
      icon: <CheckCircle2 size={14} className="text-emerald-500" />
    };
  };

  // Filter products for the listing tab
  const filteredProductsList = products.filter(p => {
    const matchQuery = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchQuery;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-5xl transform overflow-hidden rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl transition-all"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 p-2.5 text-white shadow-md shadow-violet-600/10">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  Gestão Inteligente AI
                </h3>
                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">
                  Relatório Analítico & Diagnóstico do Inventário
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="rounded-xl border border-zinc-150 dark:border-zinc-800 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-6 bg-zinc-50/50 dark:bg-zinc-950/20 border-b border-zinc-100 dark:border-zinc-800">
            <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-blue-600">
                <Package size={18} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-405">SKUs Ativos</span>
                <span className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">{totalProducts}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-amber-505 text-amber-500">
                <AlertTriangle size={18} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-405">Estoque Baixo</span>
                <span className="text-lg font-black tracking-tight text-amber-500 tabular-nums">{lowStockProducts}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-xl text-red-505 text-red-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-405">Esgotados</span>
                <span className="text-lg font-black tracking-tight text-red-500 tabular-nums">{outOfStockProducts}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl text-emerald-505 text-emerald-500">
                <DollarSign size={18} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-405">Valor do Estoque</span>
                <span className="text-md font-black tracking-tight text-emerald-500 tabular-nums">
                  R$ {totalValuation.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-8">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`py-4 px-4 font-black uppercase tracking-wider text-[10px] border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'summary' 
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-650'
              }`}
            >
              <Sparkles size={14} /> Relatório Analítico
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`py-4 px-4 font-black uppercase tracking-wider text-[10px] border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'list' 
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-650'
              }`}
            >
              <Package size={14} /> Status Recente
            </button>
            <button 
              onClick={() => setActiveTab('ask')}
              className={`py-4 px-4 font-black uppercase tracking-wider text-[10px] border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'ask' 
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-650'
              }`}
            >
              <HelpCircle size={14} /> Consultar Assistente
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="p-8 max-h-[55vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'summary' && (
                <motion.div 
                  key="summary-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <TrendingUp size={14} /> Diagnóstico Geral por IA
                    </h4>
                    <button 
                      onClick={() => generateAISummary(true)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[9px] uppercase font-black tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-all disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/55"
                    >
                      <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                      Atualizar Análise
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <Loader2 size={32} className="animate-spin text-violet-605 text-violet-600" />
                      <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 animate-pulse">Relatório em processamento...</p>
                        <p className="text-[10px] text-zinc-400 mt-1">Nossa Inteligência Artificial está diagnosticando os produtos de forma estruturada.</p>
                      </div>
                    </div>
                  ) : summary ? (
                    <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-805">
                      {renderRawMarkdown(summary)}
                    </div>
                  ) : (
                    <div className="text-center py-16 dark:text-zinc-400 text-zinc-500">
                      Nenhum relatório disponível. Clique para processar.
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'list' && (
                <motion.div 
                  key="list-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-4"
                >
                  {/* Internal Filter Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar status por nome ou código..." 
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-605 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Products list with computed status */}
                  <div className="overflow-hidden border border-zinc-100 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-950/20">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/30 text-[9px] uppercase tracking-widest font-black text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                          <th className="py-4 px-6">Produto</th>
                          <th className="py-4 px-4">SKU / TAG</th>
                          <th className="py-4 px-4">Categoria</th>
                          <th className="py-4 px-4 text-center">Quant.</th>
                          <th className="py-4 px-6 text-right">Status do Estoque</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs font-bold">
                        {filteredProductsList.length > 0 ? (
                          filteredProductsList.map((p) => {
                            const status = getStockStatus(p);
                            return (
                              <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                                <td className="py-4 px-6 text-zinc-900 dark:text-zinc-105">
                                  {p.name}
                                </td>
                                <td className="py-4 px-4 text-zinc-400 font-mono text-[10px]">
                                  {p.sku || 'N/A'}
                                </td>
                                <td className="py-4 px-4 text-zinc-550 dark:text-zinc-400">
                                  {p.category || 'Sem categoria'}
                                </td>
                                <td className="py-4 px-4 text-center tabular-nums">
                                  <span className={p.quantity <= (p.minQuantity || 5) ? "text-red-550 font-black" : ""}>
                                    {p.quantity}
                                  </span>
                                  <span className="text-zinc-400 text-[10px] ml-1 font-normal">/ {p.minQuantity}</span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-wider ${status.color}`}>
                                    {status.icon}
                                    {status.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-zinc-400">
                              Nenhum produto correspondente encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === 'ask' && (
                <motion.div 
                  key="ask-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-2 pb-1">
                    <MessageSquare size={16} className="text-violet-500 animate-pulse" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      Pergunte diretamente ao Assistente Inteligente
                    </h4>
                  </div>

                  <form onSubmit={handleAskAI} className="flex gap-2.5">
                    <div className="relative flex-1">
                      <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Ex: Quais filtros de óleo estão acabando? Qual a nossa categoria mais lucrativa?" 
                        className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-605 transition-all text-zinc-800 dark:text-white"
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        disabled={isAsking}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isAsking || !userQuestion.trim()}
                      className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all relative active:scale-95 disabled:opacity-50"
                    >
                      {isAsking ? (
                        <Loader2 className="animate-spin text-white dark:text-zinc-900" size={14} />
                      ) : (
                        <Send size={14} />
                      )}
                      Consultar
                    </button>
                  </form>

                  {/* Response card */}
                  <AnimatePresence mode="wait">
                    {(isAsking || aiAnswer) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 space-y-3"
                      >
                        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 pb-2.5">
                          <div className="h-6 w-6 rounded-lg bg-violet-600 text-white flex items-center justify-center">
                            <Sparkles size={12} className={isAsking ? "animate-spin" : ""} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-450 dark:text-zinc-400">
                            Previsão & Retorno AI
                          </span>
                        </div>

                        {isAsking ? (
                          <div className="space-y-2 py-4">
                            <div className="h-3 w-1/4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                            <div className="h-3 w-3/4 bg-zinc-150 dark:bg-zinc-800/80 rounded animate-pulse" />
                            <div className="h-3 w-5/6 bg-zinc-100 dark:bg-zinc-800/60 rounded animate-pulse" />
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed font-medium">
                            {renderRawMarkdown(aiAnswer)}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 px-8 py-5 bg-zinc-50/50 dark:bg-zinc-950/20 text-[9px] uppercase tracking-widest font-black text-zinc-400">
            <span>Powered by **Gemini 3.5 Flash** Model</span>
            <span>Munago Estoque Analytics</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
