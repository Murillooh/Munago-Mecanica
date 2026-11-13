import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { iosSpring } from './lib/motion';
import { 
  Mail, 
  Lock, 
  LogIn, 
  Loader2,
  Package,
  Minimize2
} from 'lucide-react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { toast, Toaster } from 'sonner';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { PendingApproval } from './components/PendingApproval';
import { Preloader } from './components/Preloader';
import { SupportChat } from './components/SupportChat';

// Pages: cada uma vira um chunk próprio, baixado só quando a aba é aberta.
const AIAssistant = lazy(() => import('./components/AIAssistant'));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const ServiceOrders = lazy(() => import('./pages/ServiceOrders').then(m => ({ default: m.ServiceOrders })));
const Services = lazy(() => import('./pages/Services').then(m => ({ default: m.Services })));
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const SettingsView = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsView })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Login = lazy(() => import('./pages/Login'));
const MotoCheckins = lazy(() => import('./pages/MotoCheckins').then(m => ({ default: m.MotoCheckins })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

/** Baixa as telas em segundo plano logo depois de entrar: trocar de aba fica instantâneo, sem spinner. */
const prefetchPages = () => [
  () => import('./components/AIAssistant'), () => import('./pages/Inventory'), () => import('./pages/ServiceOrders'),
  () => import('./pages/Services'), () => import('./pages/Transactions'), () => import('./pages/Notifications'),
  () => import('./pages/Settings'), () => import('./pages/Users'), () => import('./pages/AdminPanel'),
  () => import('./pages/MotoCheckins'),
].forEach(load => load().catch(() => {}));

const PageFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <Loader2 size={24} className="animate-spin text-zinc-400" />
    <span className="sr-only">Carregando...</span>
  </div>
);

const AppContent: React.FC<{ onPageReady: () => void }> = ({ onPageReady }) => {
  useEffect(() => { const t = setTimeout(prefetchPages, 1500); return () => clearTimeout(t); }, []);
  const { 
    activeTab, 
    setActiveTab, 
    setInventoryLowStockFilter, 
    isViewer, 
    isMonitorMode, 
    setIsMonitorMode, 
    toggleMonitorMode,
    isSuperAdmin,
    profile,
    canViewReports,
    canCheckin,
    canManageInventory
  } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Visualizador antigo (sem perfil) só tem o painel.
    // Só depois do perfil carregar: antes disso todo mundo parece visualizador e a tela voltaria ao painel.
    if (!profile) return;
    if (isViewer && !profile.profile && activeTab !== 'dashboard') setActiveTab('dashboard');
    // Perfil sem painel (mecânico, recepção, CS, estoquista) começa na tela do seu trabalho.
    else if (profile?.profile && activeTab === 'dashboard' && !canViewReports) setActiveTab('checkin'); // todos os setores do fluxo trabalham na OS de motos
  }, [isViewer, profile, canViewReports, canCheckin, canManageInventory, activeTab, setActiveTab]);

  // Press ESC to exit monitor mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMonitorMode) {
        setIsMonitorMode(false);
        toast.info('Modo Monitor desativado (menu lateral restaurado)');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMonitorMode, setIsMonitorMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            onSeeAllLowStock={() => { setInventoryLowStockFilter(true); setActiveTab('inventory'); }} 
            onSeeAllHistory={() => setActiveTab('transactions')} 
            onNewOS={() => setActiveTab('os')} 
            isCollapsed={isMonitorMode}
            onToggleCollapse={toggleMonitorMode}
          />
        );
      case 'inventory':
        return <Inventory />;
      case 'transactions':
        return <Transactions />;
      case 'os':
        return <ServiceOrders />;
      case 'services':
        return <Services />;
      case 'checkin':
        return <MotoCheckins />;
      case 'alerts':
        return <Notifications />;
      case 'settings':
        return <SettingsView />;
      case 'users':
        return <Users />;
      case 'ai':
        return <AIAssistant />;
      case 'admin':
        // Só o admin geral; o servidor também bloqueia /admin/* para os demais.
        if (isSuperAdmin) return <AdminPanel />;
        return <Dashboard onSeeAllLowStock={() => { setInventoryLowStockFilter(true); setActiveTab('inventory'); }} onSeeAllHistory={() => setActiveTab('transactions')} onNewOS={() => setActiveTab('os')} />;
      default:
        return <Dashboard onSeeAllLowStock={() => { setInventoryLowStockFilter(true); setActiveTab('inventory'); }} onSeeAllHistory={() => setActiveTab('transactions')} onNewOS={() => setActiveTab('os')} />;
    }
  };

  return (
    <div className="ios-glass min-h-dvh bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-blue-600/20 selection:text-blue-600">
      {/* Floating control when in Monitor Mode */}
      <AnimatePresence>
        {isMonitorMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 right-4 z-50 flex items-center gap-2"
          >
            <div className="flex items-center gap-2.5 bg-zinc-900/90 dark:bg-zinc-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-700/60 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-wide">Modo Monitor</span>
              <button
                type="button"
                onClick={() => {
                  setIsMonitorMode(false);
                  toast.info('Modo Monitor desativado');
                }}
                className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-full transition-colors active:scale-95"
                title="Restaurar menu lateral (ou pressione Esc)"
              >
                <Minimize2 size={12} />
                <span>Restaurar Menu</span>
                <kbd className="hidden sm:inline-block px-1 text-[9px] uppercase font-mono bg-black/40 text-zinc-300 rounded">Esc</kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - completely hidden in Monitor Mode */}
      {!isMonitorMode && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          setInventoryLowStockFilter={setInventoryLowStockFilter}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />
      )}
      
      <main 
        className={`transition-all duration-300 ${
          isMonitorMode 
            ? 'w-full min-h-dvh p-0 m-0 pb-6 lg:pl-0' 
            // pb extra para a nova barra (h-16 ~64px + safe-area + margem)
            : `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 pt-safe lg:pt-0 ${isCollapsed ? 'lg:pl-[4.25rem]' : 'lg:pl-64'}`
        }`}
      >
        <div className={`w-full overflow-x-clip ${isMonitorMode ? 'px-3 sm:px-6 lg:px-8 2xl:px-12 py-5 max-w-none' : 'px-3 sm:px-5 lg:px-8 2xl:px-10 py-3 sm:py-5 lg:py-6 max-w-none'}`}>
          {/* Troca de aba: a tela nova entra na hora, só esmaecendo e subindo 6px (sem escala: animar a página inteira pesa). */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<PageFallback />}>
              {renderContent()}
              <ReadySignal onReady={onPageReady} />
            </Suspense>
          </motion.div>
        </div>
      </main>

      {!isMonitorMode && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      <SupportChat />
    </div>
  );
};

/** Renderiza junto do conteúdo dentro do Suspense: só monta quando o código da página já carregou. */
const ReadySignal: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  useEffect(onReady, [onReady]);
  return null;
};

const PRELOAD_MIN_MS = 2200;
const PRELOAD_MAX_MS = 12000;

/**
 * O sistema monta por baixo do preload; ele só sai (com fade) quando sessão, dados, código da página
 * e fontes estão prontos, e nunca antes de PRELOAD_MIN_MS. PRELOAD_MAX_MS evita ficar preso.
 */
const RootApp = () => {
  const { loading, dataReady } = useApp();
  const location = useLocation();
  const [pageReady, setPageReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const onPageReady = React.useCallback(() => setPageReady(true), []);

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), Math.max(0, PRELOAD_MIN_MS - performance.now()));
    const max = setTimeout(() => setTimedOut(true), PRELOAD_MAX_MS);
    document.fonts.ready.then(() => setFontsReady(true), () => setFontsReady(true));
    return () => { clearTimeout(min); clearTimeout(max); };
  }, []);

  const ready = timedOut || (!loading && dataReady && pageReady && minElapsed && fontsReady);
  // ?preload em desenvolvimento: segura a tela de carregamento para revisar o visual.
  const hold = import.meta.env.DEV && new URLSearchParams(location.search).has('preload');

  return (
    <>
      {!loading && <RootScreens onPageReady={onPageReady} />}
      <AnimatePresence>
        {(!ready || hold) && (
          <motion.div key="preloader" initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <Preloader />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const RootScreens: React.FC<{ onPageReady: () => void }> = ({ onPageReady }) => {
  const { user, profile, handleLogout, settings, refreshProfile } = useApp();

  if (!user) return (
    <Suspense fallback={<div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950"><PageFallback /></div>}>
      <Login />
      <ReadySignal onReady={onPageReady} />
    </Suspense>
  );
  
  if (profile?.status === 'pending') {
    return (
      <>
      <ReadySignal onReady={onPageReady} />
      <PendingApproval
        storeName={settings?.storeName || 'Munago Mecânica'}
        email={profile?.email}
        onRefresh={refreshProfile}
        onLogout={handleLogout}
      />
      </>
    );
  }

  if (profile?.status === 'denied') {
    return (
      <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <ReadySignal onReady={onPageReady} />
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center shadow-lg">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-5 border border-red-200/60 dark:border-red-800/50">
            <LogIn size={26} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Acesso Negado</h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed dark:text-zinc-400">
            Sua solicitação de entrada no sistema foi recusada. Entre em contato com a administração da oficina se acreditar que trata-se de um equívoco.
          </p>
          <div className="flex flex-col gap-2.5 mt-6">
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg font-semibold text-xs hover:bg-zinc-800 transition-colors shadow-xs"
            >
              Tentar Novamente
            </button>
            <button 
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-semibold text-xs transition-colors"
            >
              Voltar para Tela de Login (Sair)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AppContent onPageReady={onPageReady} />;
};

// Sem este Toaster nenhum toast() do app aparece na tela.
const AppToaster = () => {
  const { darkMode } = useApp();
  return <Toaster position="top-right" richColors closeButton theme={darkMode ? 'dark' : 'light'} />;
};

const App = () => {
  return (
    // Mola macOS/iOS como padrão de todas as animações; "reduzir movimento" do aparelho desliga.
    <MotionConfig transition={iosSpring} reducedMotion="user">
      <BrowserRouter>
        <RootApp />
        <AppToaster />
      </BrowserRouter>
    </MotionConfig>
  );
};

export default App;

