import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { toast } from 'sonner';

// Components
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';

// Pages: cada uma vira um chunk próprio, baixado só quando a aba é aberta.
const AIAssistant = lazy(() => import('./components/AIAssistant'));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const ServiceOrders = lazy(() => import('./pages/ServiceOrders').then(m => ({ default: m.ServiceOrders })));
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const Notifications = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const SettingsView = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsView })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Login = lazy(() => import('./pages/Login'));

const PageFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <Loader2 size={24} className="animate-spin text-zinc-400" />
    <span className="sr-only">Carregando...</span>
  </div>
);

const AppContent = () => {
  const { 
    activeTab, 
    setActiveTab, 
    setInventoryLowStockFilter, 
    isViewer, 
    isMonitorMode, 
    setIsMonitorMode, 
    toggleMonitorMode 
  } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isViewer && activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    }
  }, [isViewer, activeTab, setActiveTab]);

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
      case 'alerts':
        return <Notifications />;
      case 'settings':
        return <SettingsView />;
      case 'users':
        return <Users />;
      case 'ai':
        return <AIAssistant />;
      default:
        return <Dashboard onSeeAllLowStock={() => { setInventoryLowStockFilter(true); setActiveTab('inventory'); }} onSeeAllHistory={() => setActiveTab('transactions')} onNewOS={() => setActiveTab('os')} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-blue-600/20 selection:text-blue-600">
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
            ? 'w-full min-h-screen p-0 m-0 pb-6 lg:pl-0' 
            : `pb-24 lg:pb-0 ${isCollapsed ? 'lg:pl-[4.25rem]' : 'lg:pl-64'}`
        }`}
      >
        <div className={`w-full ${isMonitorMode ? 'px-4 sm:px-6 lg:px-8 2xl:px-12 py-5 max-w-none' : 'px-4 sm:px-6 lg:px-8 2xl:px-10 py-6 max-w-none'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<PageFallback />}>
                {renderContent()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {!isMonitorMode && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
};

const RootApp = () => {
  const { user, profile, loading, handleLogout, settings } = useApp();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 selection:bg-blue-600/20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center max-w-xs text-center"
        >
          {/* Brand Mark */}
          <div className="relative mb-5">
            <div className="w-14 h-14 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border border-zinc-700/30 dark:border-zinc-300">
              ME
            </div>
            <div className="absolute -inset-1.5 rounded-2xl bg-blue-500/10 blur-md -z-10" />
          </div>

          <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
            {settings?.storeName || 'Munago Estoque'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Carregando ambiente operacional...
          </p>

          {/* Smooth Linear Progress Track */}
          <div className="w-48 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-6 relative">
            <motion.div 
              className="h-full bg-blue-600 rounded-full absolute"
              initial={{ left: '-40%', width: '30%' }}
              animate={{ left: '100%', width: '45%' }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 mt-5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sincronizando dados</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950"><PageFallback /></div>}>
      <Login />
    </Suspense>
  );
  
  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center shadow-lg">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl flex items-center justify-center mx-auto mb-5 border border-amber-200/60 dark:border-amber-800/50">
            <Loader2 size={26} className="animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Acesso em Análise</h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed dark:text-zinc-400">
            Sua solicitação de acesso foi enviada com sucesso. Um administrador da <span className="font-semibold text-zinc-900 dark:text-white">{settings?.storeName || 'Munago Estoque'}</span> revisará seu perfil em breve.
          </p>
          <div className="mt-5 p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium leading-relaxed">
            Assim que um administrador aprovar, saia e entre novamente para acessar o sistema.
          </div>
          <button 
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-semibold text-xs transition-colors"
          >
            Voltar para Tela de Login (Sair)
          </button>
        </div>
      </div>
    );
  }

  if (profile?.status === 'denied') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
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

  return <AppContent />;
};

const App = () => {
  return (
    <BrowserRouter>
      <RootApp />
    </BrowserRouter>
  );
};

export default App;

