import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Boxes, 
  ClipboardList,
  ClipboardCheck,
  Hammer,
  ArrowLeftRight, 
  BellDot, 
  UsersRound, 
  SlidersHorizontal, 
  LogOut, 
  MoreHorizontal,
  BrainCircuit,
  ShieldHalf,
  ChevronRight,
  X
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
    isSuperAdmin,
    profile,
    canCheckin,
    canManageOS,
    canManageInventory,
    canApproveOS
  } = useApp();

  const unreadCount = notifications.filter(n => !n.read).length;

  const items = [
    ...(canViewReports    ? [{ id: 'dashboard', label: 'Início',   icon: BarChart3    }] : []),
    ...(canViewInventory  ? [{ id: 'inventory', label: 'Estoque',  icon: Boxes        }] : []),
    ...(canViewOS         ? [{ id: 'os',        label: 'OS',       icon: ClipboardList}] : []),
    ...(!isViewer         ? [{ id: 'ai',        label: 'IA',       icon: BrainCircuit }] : []),
    ...(isAdmin || canManageUsers || canViewOS ? [{ id: 'more', label: 'Mais', icon: MoreHorizontal }] : []),
  ];

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /** Seções do drawer "Mais" — lista vertical estilo iOS Settings */
  const moreGroups = [
    {
      label: 'Operação',
      items: [
        ...(canCheckin || canManageOS || canApproveOS || canManageInventory || canViewReports ? [{ id: 'checkin',      label: 'OS de motos', icon: ClipboardCheck, gradient: 'bg-blue-500'    }] : []),
        ...(canViewOS           ? [{ id: 'services',     label: 'Serviços',        icon: Hammer,           gradient: 'bg-green-500'  }] : []),
        ...(canPerformTransactions ? [{ id: 'transactions', label: 'Movimentações',   icon: ArrowLeftRight,   gradient: 'bg-slate-500'  }] : []),
      ],
    },
    {
      label: 'Gestão',
      items: [
        { id: 'alerts',   label: 'Alertas',         icon: BellDot,        gradient: 'bg-yellow-400',  badge: unreadCount },
        ...(canManageUsers   ? [{ id: 'users',    label: 'Equipe e acessos',icon: UsersRound,     gradient: 'bg-teal-500'      }] : []),
        ...(isSuperAdmin     ? [{ id: 'admin',    label: 'Painel geral',    icon: ShieldHalf,     gradient: 'bg-slate-600'    }] : []),
        ...(isAdmin          ? [{ id: 'settings', label: 'Configurações',   icon: SlidersHorizontal, gradient: 'bg-zinc-500'  }] : []),
      ],
    },
  ].filter(g => g.items.length > 0);

  const iconColors: Record<string, string> = {
    dashboard:    'bg-blue-500',
    inventory:    'bg-orange-400',
    os:           'bg-red-500',
    ai:           'bg-pink-500',
    more:         'bg-zinc-400',
  };

  // Iniciais do usuário para o avatar no drawer
  const nameParts = (profile?.name || 'U').trim().split(/\s+/);
  const initials = (nameParts[0][0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '')).toUpperCase();

  return (
    <>
      {/* ── Barra inferior ── */}
      <nav
        aria-label="Navegação"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="
          bg-white/75 dark:bg-zinc-900/80
          backdrop-blur-2xl backdrop-saturate-[1.8]
          border border-white/60 dark:border-white/8
          rounded-xl
          shadow-[0_-2px_32px_rgba(0,0,0,0.10)]
          flex items-center justify-around
          h-16 px-1
        ">
          {items.map((item) => {
            const active = activeTab === item.id && item.id !== 'more';
            const gradient = iconColors[item.id] ?? 'bg-zinc-500';
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => item.id === 'more' ? setIsMenuOpen(true) : setActiveTab(item.id)}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-all duration-200 active:scale-90"
              >
                {/* Pill de fundo no item ativo */}
                {active && (
                  <motion.span
                    layoutId="bottomNavPill"
                    className="absolute inset-x-1 inset-y-1.5 rounded-xl bg-zinc-100 dark:bg-white/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}

                <span className="relative flex items-center justify-center w-10 h-8">
                  <item.icon size={21} strokeWidth={2} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'} aria-hidden="true" />
                  {/* Badge "Mais" se houver alertas */}
                  {item.id === 'more' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full px-0.5 border-2 border-white dark:border-zinc-900">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>

                <span className={`
                  relative text-[9px] font-bold                   transition-colors duration-200
                  ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}
                `}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Drawer "Mais" ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 bg-[#f2f2f7] dark:bg-zinc-950 rounded-t-[2rem] shadow-2xl max-h-[88dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Handle + cabeçalho */}
              <div className="sticky top-0 bg-[#f2f2f7]/95 dark:bg-zinc-950/95 backdrop-blur-md pt-3 pb-4 px-5 border-b border-zinc-200/60 dark:border-zinc-800/60 z-10">
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between">
                  {/* Avatar + nome */}
                  <div className="flex items-center gap-3">
                    {profile?.photoURL ? (
                      <img src={profile.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{initials}</span>
                    )}
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{profile?.name || 'Usuário'}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{profile?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 active:scale-90 transition-transform"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Grupos — estilo iOS Settings */}
              <div className="px-4 pt-5 space-y-5">
                {moreGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 px-1 mb-2">
                      {group.label}
                    </p>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 shadow-sm">
                      {group.items.map((item, i) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800"
                        >
                          <span className="flex items-center justify-center w-9 h-9 shrink-0">
                            <item.icon size={19} strokeWidth={2} className="text-zinc-500 dark:text-zinc-400" />
                          </span>

                          <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>

                          {/* Badge */}
                          {'badge' in item && item.badge && item.badge > 0 && (
                            <span className="min-w-[1.4rem] h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full px-1 mr-0.5">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}

                          <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Sair */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-red-50 dark:active:bg-red-950/20"
                  >
                    <span className="flex items-center justify-center w-9 h-9 shrink-0">
                      <LogOut size={19} strokeWidth={2} className="text-red-500" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-red-500">Sair da conta</span>
                  </button>
                </div>

                {/* Espaço extra para o scroll */}
                <div className="h-2" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
