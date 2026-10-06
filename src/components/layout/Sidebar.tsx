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
  ChevronLeft, 
  ChevronRight,
  Menu,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

export const Sidebar = ({ activeTab, setActiveTab, setInventoryLowStockFilter, isCollapsed, setIsCollapsed }: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  setInventoryLowStockFilter: (v: boolean) => void,
  isCollapsed: boolean,
  setIsCollapsed: (v: boolean) => void,
}) => {
  const { 
    profile, 
    isAdmin, 
    isEditor, 
    isViewer,
    handleLogout, 
    canViewReports, 
    canViewInventory, 
    canViewOS, 
    canManageUsers,
    canPerformTransactions,
    notifications,
    settings,
    isMonitorMode,
    setIsMonitorMode
  } = useApp();

  if (isMonitorMode) {
    return null;
  }

  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const menuItems = [
    ...(canViewReports ? [{ id: 'dashboard', label: 'Monitoramento', icon: LayoutDashboard }] : []),
    ...(canViewInventory ? [{ id: 'inventory', label: 'Almoxarifado', icon: Package }] : []),
    ...(canViewOS ? [{ id: 'os', label: 'Ordens de Serviço', icon: FileText }] : []),
    ...(canPerformTransactions || canViewReports ? [{ id: 'transactions', label: 'Movimentações', icon: History }] : []),
    ...(!isViewer ? [{ id: 'ai', label: 'IA Specialist', icon: Sparkles }] : []),
    ...(isAdmin ? [{ id: 'alerts', label: 'Gestão de Alertas', icon: Bell }] : []),
    ...(canManageUsers ? [{ id: 'users', label: 'Equipe & Acessos', icon: User }] : []),
    ...(isAdmin ? [{ id: 'settings', label: 'Configurações', icon: Settings }] : []),
  ];

  return (
    <motion.aside 
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 ${isCollapsed ? 'w-20' : 'w-72'} bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 z-40 transform transition-all duration-300 shadow-xl`}
    >
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-10 w-8 h-8 bg-blue-600 text-white rounded-full items-center justify-center shadow-lg z-50 hover:scale-110 transition-all group border-b-2 border-blue-700"
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
      </button>

      <div className={`flex flex-col h-full w-full ${isCollapsed ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} mb-10`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg flex items-center justify-center font-black text-xs tracking-wider shrink-0 shadow-sm"
            >
              ME
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white line-clamp-1">
                  {(!settings?.storeName || settings.storeName.toLowerCase().includes('loc')) ? 'Munago Estoque' : settings.storeName}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Gestão Operacional</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <div key={item.id} className="relative group px-1">
              <button
                onClick={() => {
                   if (item.id === 'inventory') setInventoryLowStockFilter(false);
                   setActiveTab(item.id);
                }}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3.5 rounded-2xl transition-all active:scale-95 group/btn ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20 dark:shadow-blue-500/20' 
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? 'text-white' : 'transition-colors'} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {!isCollapsed && (
                  <span className="text-sm font-bold tracking-tight">{item.label}</span>
                )}
                
                {item.id === 'alerts' && unreadCount > 0 && !isCollapsed && (
                  <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg whitespace-nowrap z-50 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0">
                  {item.label}
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-zinc-900 dark:bg-zinc-800 rotate-45" />
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={`mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800'} mb-3`}>
            <div className="relative flex-shrink-0">
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile?.name || 'Usuário'} 
                  className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center border border-zinc-700">
                  {((profile?.name || 'US').substring(0, 2)).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate tracking-tight">{profile?.name || 'Usuário'}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate uppercase font-semibold tracking-wider">
                  {isAdmin ? 'Administrador' : profile?.role === 'editor' ? 'Operador' : profile?.role === 'viewer' ? 'Visualizador' : 'Colaborador'}
                </p>
              </div>
            )}
          </div>
          
          <button 
            type="button"
            onClick={() => {
              setIsMonitorMode(true);
              toast.info('Modo Monitor ativado: a tela selecionada agora ocupa 100% do display.');
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3'} py-2 mb-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold text-xs active:scale-95 group`}
            title="Entrar em Modo Monitor (Ocultar menu lateral e focar na tela selecionada)"
          >
            <Maximize2 size={16} className="group-hover:scale-110 transition-transform" />
            {!isCollapsed && 'Modo Monitor'}
          </button>
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3'} py-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-600 transition-colors font-semibold text-xs active:scale-95 group`}
          >
            <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            {!isCollapsed && 'Desconectar'}
          </button>
        </div>
      </div>
    </motion.aside>
  );
};
