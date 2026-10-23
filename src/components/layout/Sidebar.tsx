import React from 'react';
import {
  LayoutDashboard,
  Package,
  FileText,
  Wrench,
  History,
  Bell,
  Users,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Maximize2,
  ShieldCheck,
  Building2,
  ChevronsUpDown,
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
    setIsMonitorMode,
    isSuperAdmin,
    workspaces,
    switchWorkspace
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
        ...(canViewOS ? [{ id: 'services', label: 'Serviços', icon: Wrench }] : []),
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
        ...(isSuperAdmin ? [{ id: 'admin', label: 'Painel geral', icon: ShieldCheck }] : []),
        ...(isAdmin ? [{ id: 'settings', label: 'Configurações', icon: Settings }] : []),
      ],
    },
  ].filter(g => g.items.length > 0);

  const storeName = (!settings?.storeName || settings.storeName.toLowerCase().includes('loc')) ? 'Munago Mecânica' : settings.storeName;
  const roleLabel = isAdmin ? 'Administrador' : profile?.role === 'editor' ? 'Operador' : profile?.role === 'viewer' ? 'Visualizador' : 'Colaborador';
  // Iniciais do primeiro e do último nome ("Murillo Silva" → "MS"); nome único → só a primeira letra.
  const nameParts = (profile?.name || 'Usuário').trim().split(/\s+/);
  const initials = (nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();
  const activeWorkspaceId = profile?.workspace?.id ?? profile?.workspaceId ?? '';
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const go = (id: string) => {
    if (id === 'inventory') setInventoryLowStockFilter(false);
    setActiveTab(id);
  };

  const enterMonitor = () => {
    setIsMonitorMode(true);
    toast.info('Modo Monitor ativado: a tela selecionada agora ocupa 100% do display.');
  };

  const logoutIcon = 'flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50 dark:hover:bg-red-950/40 cursor-pointer';

  // Foto (Google) ou iniciais, com contorno e o ponto verde de online.
  const avatar = (size: string) => (
    <span className="relative inline-flex shrink-0">
      {profile?.photoURL ? (
        <img src={profile.photoURL} alt="" className={`${size} rounded-full object-cover ring-2 ring-zinc-900/10 dark:ring-white/15`} referrerPolicy="no-referrer" />
      ) : (
        <span className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-zinc-900/10 dark:ring-white/15`} aria-hidden="true">{initials}</span>
      )}
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" aria-label="Online" />
    </span>
  );

  const iconButton = 'flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer';

  return (
    <aside
      aria-label="Navegação"
      className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 ${isCollapsed ? 'w-[4.25rem]' : 'w-64'} border-r border-zinc-200 bg-white text-zinc-600 transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400`}
    >
      {/* Marca + recolher */}
      <div className={`flex h-16 shrink-0 items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2'}`}>
        {!isCollapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/brand/munago-mecanica-icon.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl shadow-sm" />
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

      {/* Admin geral: escolhe qual oficina está administrando (cartão; o select nativo fica por cima, invisível) */}
      {isSuperAdmin && !isCollapsed && workspaces.length > 0 && (
        <div className="shrink-0 px-3 pt-3">
          <div className="relative rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-3 text-white shadow-lg shadow-blue-900/20 focus-within:ring-2 focus-within:ring-blue-400">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100/80">Oficina ativa</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15">
                <Building2 size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold">
                  {activeWorkspace?.name ?? storeName}
                  {activeWorkspace?.id === profile?.workspaceId && <span className="ml-1 text-[11px] font-normal text-blue-100/80">(minha)</span>}
                </p>
                <p className="truncate text-[11px] text-blue-100/80">
                  {activeWorkspace?.userCount ?? 0} {activeWorkspace?.userCount === 1 ? 'usuário' : 'usuários'} · {workspaces.length} oficinas
                </p>
              </div>
              <ChevronsUpDown size={16} className="shrink-0 text-blue-100/80" aria-hidden="true" />
            </div>
            <label htmlFor="workspace-switcher" className="sr-only">Trocar de oficina</label>
            <select
              id="workspace-switcher"
              value={activeWorkspaceId}
              onChange={(e) => switchWorkspace(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl opacity-0"
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.id === profile?.workspaceId ? ' (minha)' : ''} · {w.userCount ?? 0} usuário(s)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
                      className={`relative flex h-10 w-full items-center rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 cursor-pointer ${
                        isCollapsed ? 'justify-center' : 'gap-3 px-3'
                      } ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-md shadow-blue-600/25'
                          : 'font-medium hover:bg-zinc-900/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-zinc-100'
                      }`}
                    >
                      <item.icon size={18} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" aria-hidden="true" />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      {showCount && !isCollapsed && (
                        <span className={`ml-auto min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${
                          active
                            ? 'bg-white/25 text-white'
                            : item.tone === 'alert'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : 'bg-zinc-900/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300'
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

      {/* Rodapé: cartão do usuário (foto, nome, e-mail, função) + sair */}
      <div className="shrink-0 p-3">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-900/5 bg-zinc-900/[0.03] p-1.5 dark:border-white/10 dark:bg-white/5">
            <span title={`${profile?.name || 'Usuário'} · ${roleLabel}`}>{avatar('h-9 w-9')}</span>
            <button type="button" onClick={enterMonitor} aria-label="Modo Monitor" title="Modo Monitor: tela cheia, sem menu" className={iconButton}>
              <Maximize2 size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={handleLogout} aria-label="Sair da conta" title="Sair da conta" className={logoutIcon}>
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-zinc-900/10 bg-zinc-900/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <button type="button" onClick={enterMonitor} aria-label="Modo Monitor" title="Modo Monitor: tela cheia, sem menu" className={`absolute right-2 top-2 ${iconButton}`}>
              <Maximize2 size={14} aria-hidden="true" />
            </button>
            <div className="flex items-center gap-3 pr-6">
              {avatar('h-11 w-11')}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{profile?.name || 'Usuário'}</p>
                {profile?.email && <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{profile.email}</p>}
                <span className="mt-1 inline-block rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                  {roleLabel}
                </span>
              </div>
            </div>
            <div className="mt-3 border-t border-zinc-900/10 pt-2 dark:border-white/10">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/50 dark:text-red-400 cursor-pointer"
              >
                <LogOut size={16} aria-hidden="true" /> Sair da conta
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
