import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  History, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Sparkles, 
  Loader2, 
  Calendar, 
  Clock, 
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Maximize2,
  Minimize2,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Search,
  ChevronRight,
  Download,
  ShieldAlert,
  Wrench,
  Car,
  FileDown,
  X,
  Copy,
  ExternalLink,
  Check,
  Activity,
  Boxes,
  Play,
  Pause,
  Tv,
  ChevronLeft,
  Eye,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { ProductMovementTrendChart } from '../components/dashboard/ProductMovementTrendChart';
import { OSRevenueChart } from '../components/dashboard/OSRevenueChart';
import { RevenueSplitCard } from '../components/dashboard/RevenueSplitCard';
import { TopConsumedParts } from '../components/dashboard/TopConsumedParts';
import { CategoryDonut } from '../components/dashboard/CategoryDonut';
import { StockCoverage } from '../components/dashboard/StockCoverage';
import { Sparkline } from '../components/dashboard/Sparkline';
import { iconBadge, isBilledOS, osAmount, osBilledDate, startOfDayAgo, DAY_MS } from '../components/dashboard/utils';
import { authFetch } from '../lib/api';

interface DashboardProps {
  onSeeAllLowStock: () => void;
  onSeeAllHistory: () => void;
  onNewOS: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Dashboard = ({ 
  onSeeAllLowStock, 
  onSeeAllHistory, 
  onNewOS,
  isCollapsed = false,
  onToggleCollapse
}: DashboardProps) => {
  const { 
    products, 
    transactions, 
    isEditor, 
    isAdmin,
    isViewer,
    profile,
    canManageInventory,
    canManageOS,
    canPerformTransactions,
    canViewReports,
    serviceOrders,
    settings,
    isMonitorMode,
    toggleMonitorMode,
    darkMode
  } = useApp();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // =========================================================================
  // WALL MONITOR AUTO-SCROLL (Ativa apenas com Modo Monitor ligado)
  // =========================================================================
  const [isAutoScrollActive, setIsAutoScrollActive] = useState(settings.monitorAutoScrollEnabled !== false);
  const [scrollIntervalSec, setScrollIntervalSec] = useState(settings.monitorScrollIntervalSeconds || 12);
  const [activeWidgetIndex, setActiveWidgetIndex] = useState(0);
  const [autoScrollProgress, setAutoScrollProgress] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Synchronize with Firestore settings if changed elsewhere
  useEffect(() => {
    if (settings.monitorAutoScrollEnabled !== undefined) {
      setIsAutoScrollActive(settings.monitorAutoScrollEnabled);
    }
    if (settings.monitorScrollIntervalSeconds) {
      setScrollIntervalSec(settings.monitorScrollIntervalSeconds);
    }
  }, [settings.monitorAutoScrollEnabled, settings.monitorScrollIntervalSeconds]);

  const MONITOR_SECTIONS = useMemo(() => [
    {
      id: 'widget-section-kpis',
      title: 'Indicadores Gerais & Alertas de Ruptura',
      shortLabel: 'Indicadores',
      tag: 'Kpis & Estoque',
      badge: 'Visão Geral'
    },
    {
      id: 'widget-section-logistics-os',
      title: 'Balanço Logístico & Pátio de Ordens de Serviço',
      shortLabel: 'Balanço & Oficina',
      tag: 'Movimentações & OS',
      badge: 'Operação'
    },
    {
      id: 'widget-section-revenue',
      title: 'Faturamento de OS & Peças Mais Consumidas',
      shortLabel: 'Faturamento & Consumo',
      tag: 'Receita & Giro',
      badge: 'Financeiro'
    },
    {
      id: 'widget-section-replenishment-cat',
      title: 'Central de Reposição & Valor por Categoria',
      shortLabel: 'Reposição & Categorias',
      tag: 'Itens Críticos & Categorias',
      badge: 'Almoxarifado'
    },
    {
      id: 'widget-section-coverage',
      title: 'Cobertura de Estoque em Dias',
      shortLabel: 'Cobertura',
      tag: 'Dias de Estoque',
      badge: 'Planejamento'
    },
    {
      id: 'widget-section-audit',
      title: 'Auditoria Operacional de Movimentações',
      shortLabel: 'Auditoria em Tempo Real',
      tag: 'Logs & Histórico',
      badge: 'Auditoria'
    }
  ], []);

  // Function to smoothly scroll to a specific section
  const scrollToSection = (index: number) => {
    const target = MONITOR_SECTIONS[index];
    if (!target) return;
    setActiveWidgetIndex(index);
    setAutoScrollProgress(0);

    const el = document.getElementById(target.id);
    if (el) {
      const topOffset = 110;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  };

  // Pause auto-scroll on manual user activity, resume after 12s of idle
  const handleUserActivity = () => {
    if (!isMonitorMode || !isAutoScrollActive) return;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 12000);
  };

  useEffect(() => {
    if (!isMonitorMode) return;
    const handleScrollOrWheel = () => {
      handleUserActivity();
    };
    window.addEventListener('wheel', handleScrollOrWheel, { passive: true });
    window.addEventListener('touchmove', handleScrollOrWheel, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleScrollOrWheel);
      window.removeEventListener('touchmove', handleScrollOrWheel);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, [isMonitorMode, isAutoScrollActive]);

  // Main Auto-Scroll Timer Loop (Active only when isMonitorMode === true)
  useEffect(() => {
    if (!isMonitorMode || !isAutoScrollActive || isUserInteracting) {
      return;
    }

    const intervalMs = scrollIntervalSec * 1000;
    const stepMs = 100;
    const increment = (stepMs / intervalMs) * 100;

    const progressTimer = setInterval(() => {
      setAutoScrollProgress(prev => {
        if (prev + increment >= 100) {
          // Switch to next section smoothly
          setActiveWidgetIndex(currIndex => {
            const nextIndex = (currIndex + 1) % MONITOR_SECTIONS.length;
            const target = MONITOR_SECTIONS[nextIndex];
            const el = document.getElementById(target.id);
            if (el) {
              const topOffset = 110;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - topOffset;
              window.scrollTo({
                top: Math.max(0, offsetPosition),
                behavior: 'smooth'
              });
            }
            return nextIndex;
          });
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(progressTimer);
  }, [isMonitorMode, isAutoScrollActive, isUserInteracting, scrollIntervalSec, MONITOR_SECTIONS]);

  // Live clock updating every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Format currency helper
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Safe timestamp converter
  const parseDate = (ts: any): Date | null => {
    if (!ts) return null;
    try {
      if (typeof ts.toDate === 'function') return ts.toDate();
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  // Calculations
  const totalItems = products?.length || 0;
  const totalUnits = (products || []).reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalStockValue = (products || []).reduce((acc, p) => acc + ((p.price || 0) * (p.quantity || 0)), 0);
  
  // Low stock products sorted by critical deficit
  const lowStockProducts = useMemo(() => {
    return (products || [])
      .filter(p => (p.quantity || 0) <= (p.minQuantity || 0))
      .sort((a, b) => {
        const defA = (a.minQuantity || 0) - (a.quantity || 0);
        const defB = (b.minQuantity || 0) - (b.quantity || 0);
        return defB - defA;
      });
  }, [products]);

  const healthyItemsCount = Math.max(0, totalItems - lowStockProducts.length);
  const healthyRate = totalItems > 0 ? Math.round((healthyItemsCount / totalItems) * 100) : 100;

  // Today's transactions
  const todayTransactions = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (transactions || []).filter(t => {
      const d = parseDate(t.timestamp);
      return d ? d.toDateString() === todayStr : false;
    });
  }, [transactions]);

  const todayInQty = todayTransactions
    .filter(t => t.type === 'in')
    .reduce((acc, t) => acc + (t.quantity || 0), 0);

  const todayOutQty = todayTransactions
    .filter(t => t.type === 'out')
    .reduce((acc, t) => acc + (t.quantity || 0), 0);

  const todayNet = todayInQty - todayOutQty;

  // Active Service Orders
  const activeOS = useMemo(() => {
    return (serviceOrders || []).filter(os => os.status === 'draft' || os.status === 'in_progress');
  }, [serviceOrders]);

  const inProgressOS = useMemo(() => {
    return (serviceOrders || []).filter(os => os.status === 'in_progress');
  }, [serviceOrders]);

  const completedOS = useMemo(() => {
    return (serviceOrders || []).filter(os => os.status === 'completed' || os.status === 'paid');
  }, [serviceOrders]);

  const activeOSTotalValue = useMemo(() => {
    return activeOS.reduce((acc, os) => acc + (os.finalAmount || os.totalAmount || 0), 0);
  }, [activeOS]);

  // Recent transactions (last 7)
  const recentTransactions = useMemo(() => {
    return [...(transactions || [])]
      .sort((a, b) => {
        const da = parseDate(a.timestamp)?.getTime() || 0;
        const db = parseDate(b.timestamp)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 7);
  }, [transactions]);

  // Faturamento das OS: 30 dias (série diária para o sparkline) vs. 30 dias anteriores
  const revenue30 = useMemo(() => {
    const start = startOfDayAgo(29);
    const prevStart = startOfDayAgo(59);
    const daily = Array(30).fill(0) as number[];
    let total = 0;
    let prev = 0;
    let count = 0;
    (serviceOrders || []).filter(isBilledOS).forEach(os => {
      const d = osBilledDate(os);
      if (!d) return;
      const amount = osAmount(os);
      if (d >= start) {
        const idx = Math.floor((d.getTime() - start.getTime()) / DAY_MS);
        if (idx >= 0 && idx < 30) daily[idx] += amount;
        total += amount;
        count += 1;
      } else if (d >= prevStart) {
        prev += amount;
      }
    });
    const delta = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
    return { daily, total, count, delta };
  }, [serviceOrders]);

  // Saídas diárias dos últimos 14 dias (sparkline do volume)
  const outDaily14 = useMemo(() => {
    const start = startOfDayAgo(13);
    const daily = Array(14).fill(0) as number[];
    (transactions || []).forEach(t => {
      if (t.type !== 'out') return;
      const d = parseDate(t.timestamp);
      if (!d || d < start) return;
      const idx = Math.floor((d.getTime() - start.getTime()) / DAY_MS);
      if (idx >= 0 && idx < 14) daily[idx] += t.quantity || 0;
    });
    return daily;
  }, [transactions]);

  const sectionHighlight = (id: string) =>
    isMonitorMode && MONITOR_SECTIONS[activeWidgetIndex]?.id === id
      ? 'ring-2 ring-blue-500/80 dark:ring-blue-400/80 bg-blue-500/5 dark:bg-blue-500/10 shadow-lg shadow-blue-500/5'
      : '';

  // Generate Executive AI Summary
  const generateSummary = async () => {
    if (!products || products.length === 0) {
      toast.info("Não há itens no estoque para diagnóstico.");
      return;
    }
    
    setIsGeneratingSummary(true);
    setIsDiagnosticOpen(true);
    try {
      const sample = [...products]
        .sort((a, b) => ((b.minQuantity || 0) - (b.quantity || 0)) - ((a.minQuantity || 0) - (a.quantity || 0)))
        .slice(0, 40)
        .map(p => ({
          n: p.name,
          q: p.quantity,
          m: p.minQuantity,
          c: p.category,
          v: p.price
        }));

      const res = await authFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: `Atue como Diretor de Operações e Almoxarifado. Analise este estoque automotivo/industrial: ${JSON.stringify(sample)}.
          Gere um diagnóstico operacional executivo em português com:
          1. DIAGNÓSTICO GERAL (2 linhas sobre a saúde do estoque e índice de ruptura).
          2. TOP 3 ITENS CRÍTICOS PARA REPOSIÇÃO IMEDIATA (com justificativa de impacto).
          3. RECOMENDAÇÃO LOGÍSTICA PARA ESTA SEMANA (plano de ação direto para o almoxarifado).
          Mantenha linguagem profissional, enxuta e sem clichês.`,
          config: {
            maxOutputTokens: 600,
            temperature: 0.2,
          }
        }),
      });

      if (!res.ok) {
        throw new Error("Falha ao comunicar com o serviço de diagnóstico.");
      }

      const data = await res.json();
      setSummary(data.text || "Diagnóstico concluído.");
    } catch (err: any) {
      console.error(err);
      setSummary("Não foi possível gerar o diagnóstico no momento. Verifique sua conexão e tente novamente.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    toast.success("Diagnóstico copiado para a área de transferência!");
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleExportPDF = async () => {
    try {
      const { exportExecutiveReportToPDF } = await import('../lib/pdfExport');
      exportExecutiveReportToPDF({
        store: settings,
        products: products || [],
        transactions: transactions || [],
        serviceOrders: serviceOrders || []
      });
      toast.success("Relatório executivo em PDF exportado!");
    } catch {
      toast.error("Erro ao gerar o PDF de monitoramento.");
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Top Operational Command Bar with Generous Spacing */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{settings.storeName || 'Munago Estoque'}</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-zinc-900 dark:text-zinc-200 font-medium">Monitoramento Operacional</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sincronizado
            </span>
          </div>

          <div className="flex items-baseline gap-4 mt-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Painel de Monitoramento
            </h1>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
              {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-xs"
          >
            <Download size={14} className="text-zinc-500" />
            <span>Relatório PDF</span>
          </button>

          {/* AI Diagnostic Button */}
          {!isViewer && (
            <button
              onClick={generateSummary}
              disabled={isGeneratingSummary}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 rounded-lg transition-colors border border-zinc-200/70 dark:border-zinc-700 shadow-xs"
            >
              {isGeneratingSummary ? (
                <Loader2 size={14} className="animate-spin text-blue-600" />
              ) : (
                <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
              )}
              <span>Diagnóstico Executivo</span>
            </button>
          )}

          {/* New Service Order Primary CTA */}
          {canManageOS && (
            <button
              onClick={onNewOS}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              <Plus size={15} />
              <span>Nova OS</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WALL MONITOR AUTO-SCROLL CONTROL BAR (Ativo apenas com Modo Monitor ligado) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMonitorMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-2 z-30 p-3 sm:p-4 bg-zinc-900/95 dark:bg-zinc-900/95 text-white backdrop-blur-md rounded-2xl border border-zinc-700/80 shadow-2xl space-y-3 overflow-hidden"
          >
            {/* Top row: Status, Current Widget & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Monitor Status & Active Widget Name */}
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-600/25 text-blue-400 border border-blue-500/40 rounded-lg text-xs font-bold">
                  <Tv size={14} className="animate-pulse text-blue-400" />
                  <span className="tracking-wide uppercase text-[10px]">Painel de Parede</span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Widget {activeWidgetIndex + 1}/{MONITOR_SECTIONS.length}:
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[340px]">
                    {MONITOR_SECTIONS[activeWidgetIndex].title}
                  </span>
                </div>

                {isUserInteracting && (
                  <button
                    type="button"
                    onClick={() => setIsUserInteracting(false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg hover:bg-amber-500/30 transition-colors animate-pulse"
                    title="Auto-scroll pausado pela rolagem do usuário. Clique para retomar o ciclo."
                  >
                    <span>Pausado (interação do operador) · Retomar</span>
                  </button>
                )}
              </div>

              {/* Right: Previous, Next, Play/Pause and Speed Interval */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Previous Widget */}
                <button
                  type="button"
                  onClick={() => {
                    const prevIdx = (activeWidgetIndex - 1 + MONITOR_SECTIONS.length) % MONITOR_SECTIONS.length;
                    scrollToSection(prevIdx);
                  }}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-700"
                  title="Widget Anterior"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Auto-Scroll Play / Pause */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !isAutoScrollActive;
                    setIsAutoScrollActive(next);
                    if (next) {
                      setIsUserInteracting(false);
                      toast.success('Auto-scroll ativado');
                    } else {
                      toast.info('Auto-scroll pausado');
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs ${
                    isAutoScrollActive && !isUserInteracting
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                  title={isAutoScrollActive ? 'Pausar transição automática' : 'Iniciar auto-scroll contínuo'}
                >
                  {isAutoScrollActive && !isUserInteracting ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isAutoScrollActive && !isUserInteracting ? 'Auto-Scroll Ativo' : 'Auto-Scroll Pausado'}</span>
                </button>

                {/* Next Widget */}
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (activeWidgetIndex + 1) % MONITOR_SECTIONS.length;
                    scrollToSection(nextIdx);
                  }}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-700"
                  title="Próximo Widget"
                >
                  <ChevronRight size={15} />
                </button>

                {/* Interval / Speed Selector */}
                <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-[11px]">
                  {[8, 12, 20, 30].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setScrollIntervalSec(s);
                        setAutoScrollProgress(0);
                        toast.success(`Velocidade do auto-scroll: ${s} segundos`);
                      }}
                      className={`px-2 py-0.5 font-bold rounded-md transition-colors ${
                        scrollIntervalSec === s
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget Jump Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
              {MONITOR_SECTIONS.map((sec, idx) => {
                const isActive = activeWidgetIndex === idx;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(idx)}
                    className={`flex-1 min-w-[130px] flex items-center justify-between px-3 py-1.5 rounded-xl text-left text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-zinc-800 text-white border-blue-500 shadow-md ring-1 ring-blue-500/50'
                        : 'bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{sec.shortLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Continuous Smooth Progress Countdown Bar */}
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ease-linear ${
                  isAutoScrollActive && !isUserInteracting
                    ? 'bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400'
                    : 'bg-zinc-600'
                }`}
                style={{
                  width: `${isAutoScrollActive && !isUserInteracting ? Math.min(100, Math.max(0, autoScrollProgress)) : (isUserInteracting ? 0 : 100)}%`,
                  transitionDuration: isAutoScrollActive && !isUserInteracting ? '100ms' : '300ms'
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* BENTO GRID ARCHITECTURE (VARYING SIZES, SUBTLE BORDERS & GENEROUS GAPS) */}
      {/* ========================================================================= */}
      <div className="space-y-4">

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO 1: INDICADORES GERAIS & RUPTURA (BENTO 1, 2, 3)                   */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="widget-section-kpis"
          className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-kpis')}`}
        >
          {/* KPI 1: PATRIMÔNIO VALORADO */}
          <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-500 dark:text-zinc-400">Patrimônio em Estoque</span>
                <span className={`p-1.5 rounded-xl border ${iconBadge.blue}`}>
                  <Package size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
                {formatBRL(totalStockValue)}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{totalItems} referências cadastradas</p>
            </div>
            <div className="pt-4 mt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Valor médio / item</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
                {formatBRL(totalItems > 0 ? totalStockValue / totalItems : 0)}
              </span>
            </div>
          </div>

          {/* KPI 2: FATURAMENTO DE OS (30 DIAS) */}
          <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-500 dark:text-zinc-400">Faturamento 30 dias</span>
                <span className={`p-1.5 rounded-xl border ${iconBadge.emerald}`}>
                  <TrendingUp size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
                {formatBRL(revenue30.total)}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {revenue30.delta !== null && (
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${revenue30.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {revenue30.delta >= 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownLeft size={13} aria-hidden="true" />}
                    {revenue30.delta >= 0 ? '+' : ''}{revenue30.delta}%
                  </span>
                )}
                <span>{revenue30.count} OS concluídas</span>
              </div>
            </div>
            <div className="pt-3 mt-3">
              <Sparkline id="spark-revenue" data={revenue30.daily} color={darkMode ? '#3987e5' : '#2a78d6'} />
            </div>
          </div>

          {/* KPI 3: DISPONIBILIDADE & VOLUME */}
          <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-500 dark:text-zinc-400">Disponibilidade</span>
                <span className={`p-1.5 rounded-xl border ${iconBadge.indigo}`}>
                  <Boxes size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
                {healthyRate}%
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {new Intl.NumberFormat('pt-BR').format(totalUnits)} un · {healthyItemsCount} itens acima do mínimo
              </p>
            </div>
            <div className="pt-3 mt-3 space-y-2">
              <Sparkline id="spark-out" data={outDaily14} color={darkMode ? '#d95926' : '#eb6834'} />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Saídas diárias · últimos 14 dias</p>
            </div>
          </div>

          {/* KPI 4: MONITOR DE RUPTURA */}
          <button
            type="button"
            onClick={onSeeAllLowStock}
            className={`text-left p-6 rounded-2xl border shadow-xs transition-colors cursor-pointer flex flex-col justify-between ${
              lowStockProducts.length > 0
                ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200/90 dark:border-red-900/60 hover:border-red-300 dark:hover:border-red-800'
                : 'bg-white dark:bg-zinc-900/90 border-zinc-200/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="w-full">
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-500 dark:text-zinc-400">Risco de Ruptura</span>
                <span className={`p-2 rounded-xl border ${lowStockProducts.length > 0 ? iconBadge.red : iconBadge.emerald}`}>
                  {lowStockProducts.length > 0 ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                </span>
              </div>
              <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${
                lowStockProducts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'
              }`}>
                {lowStockProducts.length} <span className="text-lg font-normal text-zinc-500">itens</span>
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {lowStockProducts.length > 0
                  ? 'Abaixo do estoque mínimo: risco de parar OS'
                  : 'Nenhuma ruptura no catálogo agora'}
              </p>
            </div>
            <div className="w-full pt-4 mt-5 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Ação requerida</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                Ver itens <ChevronRight size={13} aria-hidden="true" />
              </span>
            </div>
          </button>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO 2: BALANÇO LOGÍSTICO & PÁTIO DE OS (BENTO 4, 5)                  */}
        {/* ----------------------------------------------------------------------- */}
        <div 
          id="widget-section-logistics-os"
          className={`grid grid-cols-1 xl:grid-cols-12 gap-4 rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-logistics-os')}`}
        >
          {/* BENTO 4: VISUALIZAÇÃO DE TENDÊNCIA DE ENTRADAS E SAÍDAS (RECHARTS) - col-span-12 xl:col-span-8 */}
          <div className="col-span-12 xl:col-span-8 flex flex-col justify-between">
            <ProductMovementTrendChart 
              transactions={transactions || []} 
              onSeeAllHistory={onSeeAllHistory}
              defaultDays={7}
            />
          </div>

          {/* BENTO 5: PÁTIO DE SERVIÇOS & OFICINA (TOWER CELL) - col-span-12 xl:col-span-4 */}
          <div className="col-span-12 xl:col-span-4 p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                    Pátio de Ordens de Serviço
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Fluxo operacional da oficina
                  </p>
                </div>

                {canManageOS && (
                  <button
                    onClick={onNewOS}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Todas ({serviceOrders?.length || 0}) <ChevronRight size={13} />
                  </button>
                )}
              </div>

              {/* Structured Pipeline Counters */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-5 text-center">
                <div className="py-2">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-semibold uppercase">Triagem</span>
                  <span className="text-base font-bold text-zinc-900 dark:text-white tabular-nums">
                    {(serviceOrders || []).filter(os => os.status === 'draft').length}
                  </span>
                </div>
                <div className="py-2 border-x border-zinc-200/80 dark:border-zinc-700/80">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold uppercase">Execução</span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {inProgressOS.length}
                  </span>
                </div>
                <div className="py-2">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold uppercase">Concluídas</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {completedOS.length}
                  </span>
                </div>
              </div>

              {/* Active OS List */}
              <div className="space-y-3">
                {activeOS.length > 0 ? (
                  activeOS.slice(0, 3).map((os) => (
                    <div 
                      key={os.id}
                      onClick={onNewOS}
                      className="p-3.5 bg-zinc-50/70 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                          OS #{os.id.substring(0, 6)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          os.status === 'in_progress' 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                            : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                        }`}>
                          {os.status === 'in_progress' ? 'Em Andamento' : 'Rascunho'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 mt-2">
                        <span className="truncate max-w-[170px] font-semibold">
                          {os.customerName || 'Cliente sem nome'}
                        </span>
                        <span className="font-bold text-zinc-900 dark:text-white tabular-nums">
                          {formatBRL(os.finalAmount || os.totalAmount || 0)}
                        </span>
                      </div>

                      {(os.vehicleModel || os.licensePlate) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1.5">
                          <Car size={12} className="text-zinc-400" />
                          <span>{os.vehicleModel || 'Veículo'} {os.licensePlate ? `(${os.licensePlate})` : ''}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-7 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    Nenhuma ordem em andamento no pátio.
                  </div>
                )}
              </div>
            </div>

            {canManageOS && (
              <button
                onClick={onNewOS}
                className="w-full mt-5 py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Abrir Painel de Ordens
              </button>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO: FATURAMENTO DE OS & PEÇAS MAIS CONSUMIDAS                        */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="widget-section-revenue"
          className={`grid grid-cols-1 xl:grid-cols-12 gap-4 rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-revenue')}`}
        >
          <div className="col-span-12 xl:col-span-8 flex flex-col">
            <OSRevenueChart serviceOrders={serviceOrders || []} darkMode={darkMode} onOpenOS={canManageOS ? onNewOS : undefined} />
          </div>
          <div className="col-span-12 xl:col-span-4 flex flex-col">
            <TopConsumedParts transactions={transactions || []} products={products || []} onSeeAllHistory={onSeeAllHistory} />
          </div>
          <div className="col-span-12">
            <RevenueSplitCard serviceOrders={serviceOrders || []} />
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO 3: CENTRAL DE REPOSIÇÃO & CATEGORIAS (BENTO 6, 7)                */}
        {/* ----------------------------------------------------------------------- */}
        <div 
          id="widget-section-replenishment-cat"
          className={`grid grid-cols-1 xl:grid-cols-12 gap-4 rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-replenishment-cat')}`}
        >
          {/* BENTO 6: CENTRAL DE REPOSIÇÃO (EXPANSIVE TABLE) - col-span-12 xl:col-span-8 */}
          <div className="col-span-12 xl:col-span-8 p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert size={16} className={lowStockProducts.length > 0 ? "text-red-500" : "text-zinc-400"} />
                    Central de Reposição & Itens Críticos
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Produtos que atingiram o limite mínimo de segurança cadastrado
                  </p>
                </div>

                {lowStockProducts.length > 0 && (
                  <button
                    onClick={onSeeAllLowStock}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Ver todos ({lowStockProducts.length}) <ChevronRight size={13} />
                  </button>
                )}
              </div>

              {lowStockProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3">Código/SKU</th>
                        <th className="py-3 px-3">Produto</th>
                        <th className="py-3 px-3">Categoria</th>
                        <th className="py-3 px-3 text-right">Estoque / Mín</th>
                        <th className="py-3 px-3 text-right">Déficit</th>
                        <th className="py-3 px-3 text-right">Preço Unit.</th>
                        <th className="py-3 px-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {lowStockProducts.slice(0, 5).map((item) => {
                        const deficit = (item.minQuantity || 0) - (item.quantity || 0);
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                              {item.sku || 'S/SKU'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-zinc-900 dark:text-white block truncate max-w-[200px]" title={item.name}>
                                {item.name}
                              </span>
                              {item.location && (
                                <span className="text-[11px] text-zinc-400">Loc: {item.location}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                              {item.category || 'Geral'}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">
                              <span className="font-bold text-red-600 dark:text-red-400">{item.quantity}</span>
                              <span className="text-zinc-400 mx-1">/</span>
                              <span className="text-zinc-600 dark:text-zinc-400">{item.minQuantity}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-red-600 dark:text-red-400 tabular-nums">
                              -{deficit > 0 ? deficit : 0} un
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300 font-medium">
                              {formatBRL(item.price || 0)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={onSeeAllLowStock}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                              >
                                Repor
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Almoxarifado em Margem Segura</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Todos os itens cadastrados estão acima da reserva operacional mínima.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span>{lowStockProducts.length} itens requerendo compra ou ajuste de saldo</span>
              <button
                onClick={onSeeAllLowStock}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Abrir Almoxarifado Completo
              </button>
            </div>
          </div>

          {/* BENTO 7: VALOR POR CATEGORIA (ROSCA) - col-span-12 xl:col-span-4 */}
          <div className="col-span-12 xl:col-span-4 flex flex-col">
            <CategoryDonut products={products || []} darkMode={darkMode} />
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO: COBERTURA DE ESTOQUE                                             */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="widget-section-coverage"
          className={`rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-coverage')}`}
        >
          <StockCoverage products={products || []} transactions={transactions || []} onSeeAll={onSeeAllLowStock} />
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SEÇÃO 4: AUDITORIA DE MOVIMENTAÇÕES (BENTO 8)                           */}
        {/* ----------------------------------------------------------------------- */}
        <div 
          id="widget-section-audit"
          className={`col-span-12 rounded-3xl transition-all duration-700 p-1.5 ${sectionHighlight('widget-section-audit')}`}
        >
          {/* BENTO 8: AUDITORIA OPERACIONAL RECENTE (WIDE STRIP) - col-span-12       */}
          <div className="p-4 sm:p-5 bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                  Auditoria de Movimentações Recentes
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Log contínuo de entradas, devoluções e requisições para a oficina
                </p>
              </div>
              <button
                onClick={onSeeAllHistory}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                Consultar Histórico Completo <ChevronRight size={13} />
              </button>
            </div>

            {recentTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Data / Hora</th>
                      <th className="py-3 px-3">Produto / Referência</th>
                      <th className="py-3 px-3">Tipo de Operação</th>
                      <th className="py-3 px-3 text-right">Volume</th>
                      <th className="py-3 px-3">Operador</th>
                      <th className="py-3 px-3">Justificativa / OS Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {recentTransactions.map((tx) => {
                      const dateObj = parseDate(tx.timestamp);
                      const isEntry = tx.type === 'in';
                      return (
                        <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-3 font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                            {dateObj ? dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-white max-w-[220px] truncate" title={tx.productName}>
                            {tx.productName || 'Item sem nome'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              isEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {isEntry ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                              {isEntry ? 'Entrada (Compra)' : 'Saída (Oficina)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums text-zinc-900 dark:text-white">
                            {isEntry ? `+${tx.quantity}` : `-${tx.quantity}`} un
                          </td>
                          <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {tx.operator || 'Sistema'}
                          </td>
                          <td className="py-3 px-3 text-zinc-500 dark:text-zinc-400 max-w-[260px] truncate" title={tx.justification}>
                            {tx.justification || 'Operação rotineira'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center">
                Nenhuma movimentação recente registrada no sistema.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* AI Diagnostic Slide-out Drawer / Modal */}
      <AnimatePresence>
        {isDiagnosticOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Diagnóstico Operacional & Riscos de Ruptura
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Análise automatizada de conformidade e giro de estoque
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDiagnosticOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {isGeneratingSummary ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      Processando telemetria do estoque...
                    </p>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Avaliando níveis de reserva, histórico recente de saídas e calculando pontos críticos de reposição.
                    </p>
                  </div>
                ) : summary ? (
                  <div className="space-y-4 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                    {summary}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    Nenhum diagnóstico gerado ainda. Clique em atualizar para calcular.
                  </p>
                )}
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Munago Estoque · Análise Executiva
                </span>
                <div className="flex items-center gap-2">
                  {summary && (
                    <button
                      onClick={handleCopySummary}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      {copiedSummary ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      {copiedSummary ? "Copiado!" : "Copiar Diagnóstico"}
                    </button>
                  )}
                  <button
                    onClick={() => setIsDiagnosticOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
