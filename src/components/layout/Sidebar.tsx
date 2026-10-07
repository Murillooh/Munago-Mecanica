import React from 'react';
import {
  LayoutDashboard,
  Package,
  FileText,
  History,
  Bell,
  Users,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Contador ao lado do item; `tone` define a cor (alerta = vermelho). */
  count?: number;
  tone?: 'alert' | 'neutral';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

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
    isViewer,
    handleLogout,
    canViewReports,
    canViewInventory,
    canViewOS,
    canManageUsers,
    canPerformTransactions,
    notifications,
    products,
    serviceOrders,
    settings,
    isMonitorMode,
    setIsMonitorMode
  } = useApp();

  if (isMonitorMode) {
    return null;
  }

  const unreadCount = (notifications || []).filter(n => !n.read).length;
  const lowStockCount = (products || []).filter(p => (p.quantity || 0) < (p.minQuantity || 0)).length;
  const openOSCount = (serviceOrders || []).filter(os => os.status === 'draft' || os.status === 'in_progress').length;

  const groups: NavGroup[] = [
    {
      label: 'Operação',
      items: [
        ...(canViewReports ? [{ id: 'dashboard', label: 'Monitoramento', icon: LayoutDashboard }] : []),
        ...(canViewInventory ? [{ id: 'inventory', label: 'Almoxarifado', icon: Package, count: lowStockCount, tone: 'alert' as const }] : []),
        ...(canViewOS ? [{ id: 'os', label: 'Ordens de serviço', icon: FileText, count: openOSCount, tone: 'neutral' as const }] : []),
        ...(canPerformTransactions || canViewReports ? [{ id: 'transactions', label: 'Movimentações', icon: History }] : []),
      ],
    },
    {
      label: 'Inteligência',
      items: !isViewer ? [{ id: 'ai', label: 'Assistente IA', icon: Sparkles }] : [],
    },
    {
      label: 'Gestão',
      items: [
        ...(isAdmin ? [{ id: 'alerts', label: 'Alertas', icon: Bell, count: unreadCount, tone: 'alert' as const }] : []),
        ...(canManageUsers ? [{ id: 'users', label: 'Equipe e acessos', icon: Users }] : []),
        ...(isAdmin ? [{ id: 'settings', label: 'Configurações', icon: Settings }] : []),
      ],
    },
  ].filter(g => g.items.length > 0);

  const storeName = (!settings?.storeName || settings.storeName.toLowerCase().includes('loc')) ? 'Munago Mecânica' : settings.storeName;
  const roleLabel = isAdmin ? 'Administrador' : profile?.role === 'editor' ? 'Operador' : profile?.role === 'viewer' ? 'Visualizador' : 'Colaborador';
  const initials = (profile?.name || 'US').substring(0, 2).toUpperCase();

  const go = (id: string) => {
    if (id === 'inventory') setInventoryLowStockFilter(false);
    setActiveTab(id);
  };

  const enterMonitor = () => {
    setIsMonitorMode(true);
    toast.info('Modo Monitor ativado: a tela selecionada agora ocupa 100% do display.');
  };

  const iconButton = 'flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer';

  return (
    <aside
      aria-label="Navegação"
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 ${isCollapsed ? 'w-[4.25rem]' : 'w-64'} border-r border-zinc-200 bg-white text-zinc-600 transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400`}
    >
      {/* Marca + recolher */}
      <div className={`flex h-14 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800 ${isCollapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2'}`}>
        {!isCollapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/munago-mecanica-icon.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-md" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{storeName}</p>
              <p className="truncate text-[11px] text-zinc-500">Gestão da oficina</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={iconButton}
        >
          {isCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Menu principal">
        {groups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            {isCollapsed ? (
              gi > 0 && <div className="mx-2 mb-3 border-t border-zinc-200 dark:border-zinc-800" aria-hidden="true" />
            ) : (
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = activeTab === item.id;
                const showCount = !!item.count && item.count > 0;
                return (
                  <li key={item.id} className="group/item relative">
                    <button
                      type="button"
                      onClick={() => go(item.id)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={isCollapsed ? `${item.label}${showCount ? ` (${item.count})` : ''}` : undefined}
                      className={`relative flex h-9 w-full items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 cursor-pointer ${
                        isCollapsed ? 'justify-center' : 'gap-2.5 px-2.5'
                      } ${
                        active
                          ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800/80 dark:text-white'
                          : 'font-medium hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-blue-600" aria-hidden="true" />}
                      <item.icon size={18} strokeWidth={active ? 2.25 : 1.75} className={`shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-hidden="true" />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      {showCount && !isCollapsed && (
                        <span className={`ml-auto rounded px-1.5 py-px font-mono text-[11px] tabular-nums ${
                          item.tone === 'alert'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}>
                          {item.count! > 99 ? '99+' : item.count}
                        </span>
                      )}
                      {showCount && isCollapsed && item.tone === 'alert' && (
                        <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950" aria-hidden="true" />
                      )}
                    </button>

                    {isCollapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100 dark:bg-zinc-800" role="tooltip">
                        {item.label}{showCount ? ` · ${item.count}` : ''}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Rodapé: usuário + ações */}
      <div className="shrink-0 border-t border-zinc-200 p-2.5 dark:border-zinc-800">
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1.5' : 'gap-2.5 px-1'}`}>
          <div className="relative shrink-0" title={isCollapsed ? `${profile?.name || 'Usuário'} · ${roleLabel}` : undefined}>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-md object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-200 font-mono text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" aria-hidden="true">{initials}</span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" aria-label="Online" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{profile?.name || 'Usuário'}</p>
              <p className="truncate text-[11px] text-zinc-500">{roleLabel}</p>
            </div>
          )}
          <div className={`flex ${isCollapsed ? 'flex-col' : ''} items-center gap-0.5`}>
            <button type="button" onClick={enterMonitor} aria-label="Modo Monitor" title="Modo Monitor: tela cheia, sem menu" className={iconButton}>
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              title="Sair"
              className="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50 dark:hover:bg-red-950/40 cursor-pointer"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
