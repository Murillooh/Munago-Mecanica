import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Search,
  Trash2,
  X,
  Clock,
  Shield,
  Briefcase,
  UserPlus,
  Loader2,
  Package,
  Eye,
  SlidersHorizontal,
  BarChart3,
  ArrowLeftRight,
  FileText,
  Check,
  AlertTriangle,
  Users as UsersIcon
} from 'lucide-react';
import { useApp, ROLE_PRESETS, UserPermissions, UserProfile } from '../context/AppContext';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'sonner';

type Role = 'admin' | 'editor' | 'viewer';

const ROLE_META: Record<Role, { label: string; short: string; description: string; icon: React.ElementType; chip: string; badge: string }> = {
  admin: {
    label: 'Admin',
    short: 'Admin',
    description: 'Controle total: equipe, estoque, OS e configurações.',
    icon: ShieldCheck,
    chip: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
    badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/40',
  },
  editor: {
    label: 'Operador',
    short: 'Operador',
    description: 'Rotina: catálogo, entradas e saídas e ordens de serviço.',
    icon: Briefcase,
    chip: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/40',
  },
  viewer: {
    label: 'Visualizador',
    short: 'Leitura',
    description: 'Somente leitura: consulta estoque, OS e relatórios.',
    icon: Eye,
    chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/40',
  },
};

const PERMISSIONS: { id: keyof UserPermissions; label: string; short: string; description: string; icon: React.ElementType }[] = [
  { id: 'canManageInventory', label: 'Gerenciar estoque', short: 'Estoque', description: 'Cadastrar, editar e excluir peças do catálogo.', icon: Package },
  { id: 'canPerformTransactions', label: 'Movimentar estoque', short: 'Movimentação', description: 'Registrar entradas e saídas com justificativa.', icon: ArrowLeftRight },
  { id: 'canManageOS', label: 'Ordens de serviço', short: 'OS', description: 'Abrir OS, lançar peças e mudar a etapa.', icon: FileText },
  { id: 'canViewReports', label: 'Relatórios e monitoramento', short: 'Relatórios', description: 'Ver o painel e exportar PDF/Excel.', icon: BarChart3 },
  { id: 'canManageUsers', label: 'Gerenciar equipe', short: 'Equipe', description: 'Aprovar cadastros e mudar funções e permissões.', icon: Shield },
];

const roleOf = (r?: string): Role => (r === 'admin' || r === 'editor' ? r : 'viewer');

const initials = (name?: string) =>
  (name || 'U').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const Avatar: React.FC<{ name?: string; photoURL?: string; size?: 'sm' | 'md' }> = ({ name, photoURL, size = 'md' }) => {
  const cls = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  return photoURL ? (
    <img src={photoURL} alt="" className={`${cls} rounded-lg object-cover border border-zinc-200 dark:border-zinc-700`} referrerPolicy="no-referrer" />
  ) : (
    <span className={`${cls} rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold flex items-center justify-center border border-zinc-200/70 dark:border-zinc-700`} aria-hidden="true">
      {initials(name)}
    </span>
  );
};

const fieldClass =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition-colors focus:border-blue-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-600/15';

const ghostBtn = 'rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer';
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900 cursor-pointer';

/** Seletor de função + permissões, usado no cadastro e na edição. */
const AccessEditor: React.FC<{
  role: Role;
  permissions: UserPermissions;
  onRole: (r: Role) => void;
  onPermissions: (p: UserPermissions) => void;
}> = ({ role, permissions, onRole, onPermissions }) => {
  const preset = ROLE_PRESETS[role].permissions;
  const customized = PERMISSIONS.some(p => Boolean(permissions[p.id]) !== Boolean(preset[p.id]));
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Função</legend>
        <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['admin', 'editor', 'viewer'] as const).map(r => {
            const meta = ROLE_META[r];
            const Icon = meta.icon;
            const selected = role === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onRole(r)}
                className={`text-left p-3 rounded-xl border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selected
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/20 ring-1 ring-blue-600/30'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`p-1.5 rounded-lg border ${meta.badge}`}><Icon size={14} aria-hidden="true" /></span>
                  {selected && <Check size={16} className="text-blue-600" aria-hidden="true" />}
                </span>
                <span className="mt-2 block text-sm font-semibold text-zinc-900 dark:text-white">{meta.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-2 flex items-center justify-between">
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Permissões</legend>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${customized ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
            {customized ? 'Personalizadas' : `Padrão de ${ROLE_META[role].label}`}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
          {PERMISSIONS.map(perm => {
            const checked = Boolean(permissions[perm.id]);
            const Icon = perm.icon;
            return (
              <label key={perm.id} className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                <Icon size={16} className={checked ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-zinc-900 dark:text-white">{perm.label}</span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{perm.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => onPermissions({ ...permissions, [perm.id]: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-600/30 cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};

/** Moldura de modal no mesmo padrão da ficha de OS. */
const Dialog: React.FC<{ title: string; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode; labelId: string }> = ({
  title, subtitle, onClose, footer, children, labelId,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-zinc-950/60 backdrop-blur-sm sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[100dvh] sm:max-h-[min(820px,calc(100dvh-3rem))] w-full max-w-2xl flex-col overflow-hidden bg-white dark:bg-zinc-900 sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div>
            <h3 id={labelId} className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X size={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">{footer}</footer>
      </motion.div>
    </div>
  );
};

const EMPTY_NEW_USER = { name: '', email: '', role: 'editor' as Role, permissions: { ...ROLE_PRESETS.editor.permissions } };

export const Users = () => {
  const {
    users,
    updateUserRoleAndPermissions,
    approveUser,
    denyUser,
    deleteUser,
    isAdmin,
    canManageUsers,
    profile
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<Role>('viewer');
  const [editPermissions, setEditPermissions] = useState<UserPermissions>({ ...ROLE_PRESETS.viewer.permissions });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);

  useEffect(() => {
    if (canManageUsers) fetchAccessRequests();
  }, [canManageUsers]);

  const fetchAccessRequests = async () => {
    try {
      setAccessRequests(await apiGet<any[]>('/access-requests?status=pending'));
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPost('/users', {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        permissions: newUser.permissions,
      });
      toast.success('Usuário criado! O convite com a senha temporária foi enviado por e-mail.');
      setIsAddModalOpen(false);
      setNewUser(EMPTY_NEW_USER);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPermissionsModal = (user: UserProfile) => {
    const currentRole = roleOf(user.role);
    setEditingUser(user);
    setEditRole(currentRole);
    setEditPermissions(
      user.permissions && Object.keys(user.permissions).length > 0
        ? { ...user.permissions }
        : { ...ROLE_PRESETS[currentRole].permissions }
    );
  };

  // As ações do AppContext já mostram toast de sucesso/erro.
  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setIsSavingPermissions(true);
    try {
      await updateUserRoleAndPermissions(editingUser.uid, editRole, editPermissions);
      setEditingUser(null);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const runBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try { await fn(); } finally { setBusyId(null); }
  };

  const handleRequest = (request: any, action: 'approve' | 'reject') =>
    runBusy(request.id, async () => {
      try {
        await apiPost(`/access-requests/${request.id}/${action}`, action === 'approve' ? { role: 'editor' } : undefined);
        await fetchAccessRequests();
        toast.success(action === 'approve' ? `${request.name} aprovado como Operador.` : 'Pedido recusado.');
      } catch (err: any) {
        toast.error(`Erro ao ${action === 'approve' ? 'aprovar' : 'recusar'}: ${err.message}`);
      }
    });

  const allUsers = users || [];
  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const pendingTotal = pendingUsers.length + accessRequests.length;

  const roleCounts = useMemo(() => ({
    all: allUsers.length,
    admin: allUsers.filter(u => roleOf(u.role) === 'admin').length,
    editor: allUsers.filter(u => roleOf(u.role) === 'editor').length,
    viewer: allUsers.filter(u => roleOf(u.role) === 'viewer').length,
  }), [allUsers]);

  const filteredUsers = allUsers
    .filter(u => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q ||
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        ROLE_META[roleOf(u.role)].label.toLowerCase().includes(q);
      return matchesSearch && (roleFilter === 'all' || roleOf(u.role) === roleFilter);
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const th = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap';

  return (
    <div className="w-full space-y-5 pb-24 lg:pb-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Equipe & Acessos</h1>
          <p className="hidden md:block truncate text-sm text-zinc-500 dark:text-zinc-400">Quem acessa o sistema e o que cada pessoa pode fazer.</p>
        </div>
        {canManageUsers && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 cursor-pointer"
          >
            <UserPlus size={16} aria-hidden="true" />
            Novo usuário
          </button>
        )}
      </div>

      {/* Aguardando aprovação */}
      {canManageUsers && pendingTotal > 0 && (
        <section aria-labelledby="pending-heading" className="bg-white dark:bg-zinc-900/90 rounded-xl border border-amber-200/80 dark:border-amber-900/50 shadow-xs overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20">
            <Clock size={15} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <h2 id="pending-heading" className="text-sm font-semibold text-zinc-900 dark:text-white">Aguardando aprovação</h2>
            <span className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{pendingTotal}</span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {pendingUsers.map(u => (
              <li key={u.uid} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={u.name} photoURL={u.photoURL} />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{u.email} · criou a própria conta</p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === u.uid}
                      onClick={() => runBusy(u.uid, () => denyUser(u.uid))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Negar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === u.uid}
                      onClick={() => runBusy(u.uid, () => approveUser(u.uid))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {busyId === u.uid ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                      Aprovar
                    </button>
                  </div>
                )}
              </li>
            ))}
            {accessRequests.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={r.name} />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{r.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {r.email}{r.workshopName ? ` · ${r.workshopName}` : ''}{r.phone ? ` · ${r.phone}` : ''} · solicitação antiga
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleRequest(r, 'reject')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleRequest(r, 'approve')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {busyId === r.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                    Aprovar como Operador
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Equipe */}
      <section aria-label="Membros da equipe" className="bg-white dark:bg-zinc-900/90 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900">
          <div className="relative lg:w-80">
            <label htmlFor="users-search" className="sr-only">Buscar membros</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={15} aria-hidden="true" />
            <input
              id="users-search"
              type="search"
              placeholder="Nome, e-mail ou função"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 w-fit overflow-x-auto" role="group" aria-label="Filtrar por função">
            {([['all', 'Todos'], ['admin', 'Admin'], ['editor', 'Operador'], ['viewer', 'Visualizador']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRoleFilter(value)}
                aria-pressed={roleFilter === value}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === value
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {label}
                <span className="tabular-nums text-[10px] font-bold text-zinc-400">{roleCounts[value]}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className={th}>Membro</th>
                  <th scope="col" className={`${th} w-32`}>Função</th>
                  <th scope="col" className={th}>Permissões</th>
                  <th scope="col" className={`${th} w-28`}>Situação</th>
                  <th scope="col" className={`${th} w-28 text-right`}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filteredUsers.map(user => {
                  const role = roleOf(user.role);
                  const meta = ROLE_META[role];
                  const RoleIcon = meta.icon;
                  const perms = user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : ROLE_PRESETS[role].permissions;
                  const isMe = profile?.uid === user.uid;
                  return (
                    <tr key={user.uid} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={user.name} photoURL={user.photoURL} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                              {user.name || 'Sem nome'}
                              {isMe && <span className="ml-1.5 text-[10px] font-semibold text-zinc-400">(você)</span>}
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.chip}`}>
                          <RoleIcon size={12} aria-hidden="true" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {PERMISSIONS.filter(p => perms?.[p.id]).map(p => {
                            const Icon = p.icon;
                            return (
                              <span key={p.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300" title={p.label}>
                                <Icon size={11} aria-hidden="true" /> {p.short}
                              </span>
                            );
                          })}
                          {!PERMISSIONS.some(p => perms?.[p.id]) && <span className="text-zinc-400">Nenhuma</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'approved' ? 'bg-emerald-500' : user.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden="true" />
                          {user.status === 'approved' ? 'Ativo' : user.status === 'denied' ? 'Negado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {canManageUsers && (
                            <button
                              type="button"
                              onClick={() => openEditPermissionsModal(user)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              aria-label={`Editar acessos de ${user.name}`}
                            >
                              <SlidersHorizontal size={14} aria-hidden="true" />
                              <span className="hidden xl:inline">Editar</span>
                            </button>
                          )}
                          {isAdmin && !isMe && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmUser(user)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              aria-label={`Excluir ${user.name}`}
                              title="Excluir usuário"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <UsersIcon size={22} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Nenhum membro encontrado</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Mude a busca ou o filtro de função.</p>
          </div>
        )}
      </section>

      {/* Editar acessos */}
      <AnimatePresence>
        {editingUser && (
          <Dialog
            labelId="edit-access-title"
            title="Editar acessos"
            subtitle={`${editingUser.name} · ${editingUser.email}`}
            onClose={() => setEditingUser(null)}
            footer={
              <>
                <button type="button" onClick={() => setEditingUser(null)} className={ghostBtn}>Cancelar</button>
                <button type="button" disabled={isSavingPermissions} onClick={handleSavePermissions} className={primaryBtn}>
                  {isSavingPermissions ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                  {isSavingPermissions ? 'Salvando…' : 'Salvar'}
                </button>
              </>
            }
          >
            <AccessEditor
              role={editRole}
              permissions={editPermissions}
              onRole={r => { setEditRole(r); setEditPermissions({ ...ROLE_PRESETS[r].permissions }); }}
              onPermissions={setEditPermissions}
            />
          </Dialog>
        )}
      </AnimatePresence>

      {/* Novo usuário */}
      <AnimatePresence>
        {isAddModalOpen && (
          <Dialog
            labelId="new-user-title"
            title="Novo usuário"
            subtitle="A pessoa recebe por e-mail uma senha temporária para o primeiro acesso."
            onClose={() => setIsAddModalOpen(false)}
            footer={
              <>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className={ghostBtn}>Cancelar</button>
                <button type="submit" form="new-user-form" disabled={isSubmitting} className={primaryBtn}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                  {isSubmitting ? 'Enviando convite…' : 'Criar e enviar convite'}
                </button>
              </>
            }
          >
            <form id="new-user-form" onSubmit={handleAddUser} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-user-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nome completo</label>
                  <input
                    id="new-user-name"
                    type="text"
                    autoComplete="off"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    className={fieldClass}
                    placeholder="Carlos Oliveira"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-user-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">E-mail</label>
                  <input
                    id="new-user-email"
                    type="email"
                    autoComplete="off"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    className={fieldClass}
                    placeholder="carlos@oficina.com"
                    required
                  />
                </div>
              </div>
              <AccessEditor
                role={newUser.role}
                permissions={newUser.permissions}
                onRole={r => setNewUser({ ...newUser, role: r, permissions: { ...ROLE_PRESETS[r].permissions } })}
                onPermissions={p => setNewUser({ ...newUser, permissions: p })}
              />
            </form>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {deleteConfirmUser && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm"
            onMouseDown={e => { if (e.target === e.currentTarget) setDeleteConfirmUser(null); }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-user-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6"
            >
              <span className="inline-flex p-2.5 rounded-xl border bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/40">
                <AlertTriangle size={20} aria-hidden="true" />
              </span>
              <h3 id="delete-user-title" className="mt-4 text-lg font-bold text-zinc-900 dark:text-white">Excluir {deleteConfirmUser.name}?</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">O acesso é revogado na hora. Não dá para desfazer.</p>
              <div className="mt-6 flex gap-2">
                <button type="button" autoFocus onClick={() => setDeleteConfirmUser(null)} className={`flex-1 ${ghostBtn}`}>Cancelar</button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteUser(deleteConfirmUser.uid);
                      setDeleteConfirmUser(null);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900 cursor-pointer"
                >
                  {isDeleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
