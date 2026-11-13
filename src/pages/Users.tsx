import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { macZoom, macZoomProps } from '../lib/motion';
import {
  ShieldCheck,
  Search,
  Trash2,
  X,
  Clock,
  Briefcase,
  UserPlus,
  Loader2,
  Eye,
  SlidersHorizontal,
  Check,
  AlertTriangle,
  Building2,
  Plus,
  Warehouse,
  Users as UsersIcon
} from 'lucide-react';
import { useApp, UserProfile, type Unit } from '../context/AppContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { PROFILES, PROFILE_IDS, type Profile } from '../../server/auth/profiles';
import { HeroStat, PageHero, heroBtnPrimary } from '../components/PageHero';
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

/** Rótulo do acesso: perfil (novo) ou cargo (usuário antigo). */
const accessLabel = (u: UserProfile) => (u.profile && u.profile in PROFILES ? PROFILES[u.profile as Profile].label : ROLE_META[roleOf(u.role)].label);

/** Perfil de acesso + unidade, usado no cadastro e na edição. O perfil já define o que a pessoa pode fazer. */
const AccessEditor: React.FC<{
  profile: Profile;
  unitId: string;
  units: Unit[];
  onProfile: (p: Profile) => void;
  onUnit: (id: string) => void;
}> = ({ profile, unitId, units, onProfile, onUnit }) => {
  const needsUnit = !PROFILES[profile].permissions.allUnits;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Perfil de acesso</legend>
        <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROFILE_IDS.map(id => {
            const meta = PROFILES[id];
            const selected = profile === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onProfile(id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selected
                    ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600/30 dark:bg-blue-950/20'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{meta.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{meta.description}</span>
                </span>
                {selected && <Check size={16} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="access-unit" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Unidade</label>
        <select id="access-unit" value={unitId} onChange={e => onUnit(e.target.value)} className={fieldClass} required={needsUnit && units.length > 0}>
          <option value="">{needsUnit ? 'Escolha a unidade' : 'Todas as unidades'}</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}{u.kind === 'cd' ? ' (CD)' : ''}</option>)}
        </select>
        <p className="text-[11px] text-zinc-500">
          {needsUnit ? 'A pessoa só vê os dados desta unidade.' : 'Este perfil enxerga todas as unidades.'}
          {units.length === 0 && ' Cadastre as unidades em "Unidades", logo abaixo da equipe.'}
        </p>
      </div>
    </div>
  );
};

/** Cadastro das unidades (Bases e CD). */
/** Contato do franqueado da unidade (quem autoriza as manutenções). */
const FranchiseeForm: React.FC<{ unit: Unit; onDone: () => void }> = ({ unit, onDone }) => {
  const [f, setF] = useState({ franchiseeName: unit.franchiseeName ?? '', franchiseeEmail: unit.franchiseeEmail ?? '', franchiseePhone: unit.franchiseePhone ?? '' });
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPatch(`/units/${unit.id}`, { franchiseeName: f.franchiseeName || null, franchiseeEmail: f.franchiseeEmail || null, franchiseePhone: f.franchiseePhone || null });
      toast.success('Franqueado salvo.');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="grid gap-2 px-4 pb-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <input aria-label="Nome do franqueado" value={f.franchiseeName} onChange={e => setF({ ...f, franchiseeName: e.target.value })} placeholder="Nome do franqueado" maxLength={100} className={`${fieldClass} !py-2`} />
      <input aria-label="E-mail do franqueado" type="email" value={f.franchiseeEmail} onChange={e => setF({ ...f, franchiseeEmail: e.target.value })} placeholder="email@franqueado.com" maxLength={200} className={`${fieldClass} !py-2`} />
      <input aria-label="WhatsApp do franqueado" type="tel" value={f.franchiseePhone} onChange={e => setF({ ...f, franchiseePhone: e.target.value })} placeholder="WhatsApp (11) 98888-7777" maxLength={30} className={`${fieldClass} !py-2`} />
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={`${ghostBtn} !py-2`}>Cancelar</button>
        <button type="submit" disabled={saving} className={`${primaryBtn} !py-2`}>{saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}Salvar</button>
      </div>
    </form>
  );
};

const UnitsSection: React.FC<{ units: Unit[]; users: UserProfile[] }> = ({ units, users }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Unit['kind']>('base');
  const [saving, setSaving] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/units', { name, kind });
      toast.success('Unidade cadastrada.');
      setName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (u: Unit) => {
    if (!window.confirm(`Excluir a unidade "${u.name}"? As pessoas dela ficam sem unidade.`)) return;
    try { await apiDelete(`/units/${u.id}`); toast.success('Unidade excluída.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.'); }
  };
  return (
    <section aria-labelledby="units-heading" className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/90">
      <div className="flex items-center gap-2.5 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <Building2 size={15} className="text-zinc-500" aria-hidden="true" />
        <h2 id="units-heading" className="text-sm font-semibold text-zinc-900 dark:text-white">Unidades</h2>
        <span className="text-xs text-zinc-500">Bases que atendem as motos e o CD de peças</span>
      </div>
      {units.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {units.map(u => {
            const Icon = u.kind === 'cd' ? Warehouse : Building2;
            const people = users.filter(x => x.unitId === u.id).length;
            return (
              <li key={u.id}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Icon size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{u.name}</span>
                  {u.kind === 'base' && (
                    <span className="block truncate text-xs text-zinc-500">
                      {u.franchiseeName || u.franchiseeEmail || u.franchiseePhone
                        ? <>Franqueado: {[u.franchiseeName, u.franchiseeEmail, u.franchiseePhone].filter(Boolean).join(' · ')}</>
                        : <span className="text-amber-600 dark:text-amber-400">Sem franqueado cadastrado (necessário para pedir autorização)</span>}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-semibold text-zinc-500">{u.kind === 'cd' ? 'CD' : 'Base'} · {people} {people === 1 ? 'pessoa' : 'pessoas'}</span>
                {u.kind === 'base' && (
                  <button type="button" onClick={() => setEditing(editing === u.id ? null : u.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 cursor-pointer">
                    Franqueado
                  </button>
                )}
                <button type="button" onClick={() => remove(u)} aria-label={`Excluir ${u.name}`} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              {editing === u.id && <FranchiseeForm unit={u} onDone={() => setEditing(null)} />}
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/70">
        <label htmlFor="unit-name" className="sr-only">Nome da unidade</label>
        <input id="unit-name" required value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Nome da unidade (ex.: Base Centro)" className={`${fieldClass} min-w-[200px] flex-1 !py-2`} />
        <label htmlFor="unit-kind" className="sr-only">Tipo</label>
        <select id="unit-kind" value={kind} onChange={e => setKind(e.target.value as Unit['kind'])} className={`${fieldClass} w-auto !py-2`}>
          <option value="base">Base</option>
          <option value="cd">CD</option>
        </select>
        <button type="submit" disabled={saving} className={`${primaryBtn} !py-2`}>
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />} Adicionar
        </button>
      </form>
    </section>
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
        {...macZoomProps()}
        transition={macZoom}
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

const EMPTY_NEW_USER = { name: '', email: '', profile: 'mecanico' as Profile, unitId: '' };

export const Users = () => {
  const {
    users,
    units,
    approveUser,
    denyUser,
    deleteUser,
    isAdmin,
    canManageUsers,
    profile,
    isSuperAdmin
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
  const [editProfile, setEditProfile] = useState<Profile>('mecanico');
  const [editUnit, setEditUnit] = useState('');
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);

  // Pedidos do formulário público viram oficinas novas: só o admin geral analisa.
  useEffect(() => {
    if (isSuperAdmin) fetchAccessRequests();
  }, [isSuperAdmin]);

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
        profile: newUser.profile,
        unitId: newUser.unitId || null,
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
    setEditingUser(user);
    // Usuário antigo (sem perfil): parte do perfil equivalente ao cargo.
    const fallback: Profile = user.role === 'admin' ? 'admin' : user.role === 'editor' ? 'mecanico' : 'gestor';
    setEditProfile(user.profile && user.profile in PROFILES ? user.profile as Profile : fallback);
    setEditUnit(user.unitId ?? '');
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setIsSavingPermissions(true);
    try {
      await apiPatch(`/users/${editingUser.uid}`, { profile: editProfile, unitId: editUnit || null });
      toast.success('Acesso atualizado.');
      setEditingUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
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
        await apiPost(`/access-requests/${request.id}/${action}`);
        await fetchAccessRequests();
        toast.success(action === 'approve' ? `Oficina "${request.workshopName}" criada com ${request.name} como administrador.` : 'Pedido recusado.');
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
        accessLabel(u).toLowerCase().includes(q);
      return matchesSearch && (roleFilter === 'all' || roleOf(u.role) === roleFilter);
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const th = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap';

  return (
    <div className="w-full space-y-5 pb-24 lg:pb-6">
      {/* Topo + resumo da equipe (clica e filtra por função) */}
      <PageHero
        icon={UsersIcon}
        title="Equipe e acessos"
        subtitle="Quem acessa o sistema e o que cada pessoa pode fazer."
        actions={canManageUsers && (
          <button type="button" onClick={() => setIsAddModalOpen(true)} className={heroBtnPrimary}>
            <UserPlus size={15} aria-hidden="true" /> Novo usuário
          </button>
        )}
        statsClassName="grid-cols-2 @3xl:grid-cols-4"
      >
        <HeroStat
          icon={UsersIcon} iconClass="bg-blue-500" label="Membros"
          value={allUsers.length} hint="com acesso a esta oficina"
          selected={roleFilter === 'all'} onClick={() => setRoleFilter('all')}
        />
        <HeroStat
          icon={ShieldCheck} iconClass="bg-violet-500" label="Administradores"
          value={allUsers.filter(u => roleOf(u.role) === 'admin').length} hint="acesso total"
          selected={roleFilter === 'admin'} onClick={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
        />
        <HeroStat
          icon={Briefcase} iconClass="bg-emerald-500" label="Operadores"
          value={allUsers.filter(u => roleOf(u.role) === 'editor').length} hint="estoque, OS e movimentações"
          selected={roleFilter === 'editor'} onClick={() => setRoleFilter(roleFilter === 'editor' ? 'all' : 'editor')}
        />
        <HeroStat
          icon={Clock} iconClass="bg-amber-500" label="Aguardando"
          alert={pendingTotal > 0}
          value={pendingTotal} hint={pendingTotal > 0 ? 'cadastros para aprovar' : 'ninguém esperando'}
        />
      </PageHero>

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
          <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-700 max-w-full w-fit overflow-x-auto" role="group" aria-label="Filtrar por função">
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
          <>
          {/* Celular: um cartão por pessoa (a tabela não cabe em 360–430 px) */}
          <ul className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {filteredUsers.map(user => {
              const role = roleOf(user.role);
              const meta = ROLE_META[role];
              const RoleIcon = meta.icon;
              const isMe = profile?.uid === user.uid;
              return (
                <li key={user.uid} className="px-3 py-3 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={user.name} photoURL={user.photoURL} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {user.name || 'Sem nome'}
                        {isMe && <span className="ml-1.5 text-[10px] font-semibold text-zinc-400">(você)</span>}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManageUsers && (
                        <button
                          type="button"
                          onClick={() => openEditPermissionsModal(user)}
                          className="p-2 rounded-lg text-zinc-500 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors cursor-pointer"
                          aria-label={`Editar acessos de ${user.name}`}
                        >
                          <SlidersHorizontal size={16} aria-hidden="true" />
                        </button>
                      )}
                      {isAdmin && !isMe && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmUser(user)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          aria-label={`Excluir ${user.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-[2.625rem]">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.chip}`}>
                      <RoleIcon size={12} aria-hidden="true" /> {accessLabel(user)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500"><Building2 size={11} aria-hidden="true" />{units.find(x => x.id === user.unitId)?.name ?? 'Todas as unidades'}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'approved' ? 'bg-emerald-500' : user.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'}`} aria-hidden="true" />
                      {user.status === 'approved' ? 'Ativo' : user.status === 'denied' ? 'Negado' : 'Pendente'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className={th}>Membro</th>
                  <th scope="col" className={`${th} w-44`}>Perfil</th>
                  <th scope="col" className={th}>Unidade</th>
                  <th scope="col" className={`${th} w-28`}>Situação</th>
                  <th scope="col" className={`${th} w-28 text-right`}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filteredUsers.map(user => {
                  const role = roleOf(user.role);
                  const meta = ROLE_META[role];
                  const RoleIcon = meta.icon;
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
                          <RoleIcon size={12} aria-hidden="true" /> {accessLabel(user)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-zinc-600 dark:text-zinc-300">{units.find(x => x.id === user.unitId)?.name ?? <span className="text-zinc-400">Todas</span>}</span>
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
                              <span>Editar</span>
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
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <UsersIcon size={22} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Nenhum membro encontrado</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Mude a busca ou o filtro de função.</p>
          </div>
        )}
      </section>

      {canManageUsers && <UnitsSection units={units} users={allUsers} />}

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
            <AccessEditor profile={editProfile} unitId={editUnit} units={units} onProfile={setEditProfile} onUnit={setEditUnit} />
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
                profile={newUser.profile}
                unitId={newUser.unitId}
                units={units}
                onProfile={p => setNewUser({ ...newUser, profile: p })}
                onUnit={u => setNewUser({ ...newUser, unitId: u })}
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
              {...macZoomProps()}
              transition={macZoom}
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
