import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  History, 
  Bell, 
  User, 
  Settings, 
  LogOut, 
  Menu,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { 
    canViewReports, 
    canViewInventory, 
    canViewOS, 
    canPerformTransactions,
    isAdmin,
    canManageUsers,
    notifications,
    handleLogout,
    isViewer,
    isSuperAdmin
  } = useApp();

  const unreadCount = notifications.filter(n => !n.read).length;

  const items = [
    ...(canViewReports ? [{ id: 'dashboard', label: 'Início', icon: LayoutDashboard }] : []),
    ...(canViewInventory ? [{ id: 'inventory', label: 'Estoque', icon: Package }] : []),
    ...(canViewOS ? [{ id: 'os', label: 'Serviços', icon: FileText }] : []),
    ...(!isViewer ? [{ id: 'ai', label: 'IA', icon: Sparkles }] : []),
    ...(isAdmin || canManageUsers ? [{ id: 'more', label: 'Menu', icon: Menu }] : []),
  ];

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const moreItems = [
    ...(canPerformTransactions ? [{ id: 'transactions', label: 'Movimentações', icon: History }] : []),
    ...(isAdmin ? [{ id: 'alerts', label: 'Alertas', icon: Bell, count: unreadCount }] : []),
    ...(canManageUsers ? [{ id: 'users', label: 'Usuários', icon: User }] : []),
    ...(isAdmin ? [{ id: 'settings', label: 'Ajustes', icon: Settings }] : []),
    ...(isSuperAdmin ? [{ id: 'admin', label: 'Painel geral', icon: ShieldCheck }] : []),
    { id: 'logout', label: 'Sair', icon: LogOut, color: 'text-red-500' }
  ];

  return (
    <>
      {/* pb com a área segura: no iPhone o menu fica acima da barra de gestos. */}
      <nav aria-label="Navegação" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.12)] flex items-center justify-around h-[4.25rem] px-1.5 relative">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => item.id === 'more' ? setIsMenuOpen(true) : setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-w-[3.5rem] flex-1 max-w-[4.5rem] h-14 rounded-2xl transition-all relative ${
                activeTab === item.id 
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="bottomTab"
                  className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] rounded-t-[2rem] shadow-2xl max-h-[85dvh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-6 uppercase tracking-tight">Mais Opções</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {moreItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'logout') handleLogout();
                      else setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`flex flex-col items-start gap-3 p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] border border-zinc-100 dark:border-zinc-700 transition-all active:scale-95 ${item.color || 'text-zinc-700 dark:text-zinc-300'}`}
                  >
                    <div className={`p-3 rounded-2xl ${item.color ? 'bg-red-100 dark:bg-red-900/20' : 'bg-white dark:bg-zinc-800'} shadow-sm relative`}>
                      <item.icon size={20} />
                      {item.count ? (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-zinc-50 dark:border-zinc-800">
                          {item.count}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-full mt-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
              >
                Fechar Menu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
