import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Users, FileText, Wallet, Search, RefreshCw, LogIn, ChevronDown, Loader2, AlertTriangle, ShieldCheck, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, setActiveWorkspace } from '../lib/api';
import { useApp } from '../context/AppContext';

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: string;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: string;
  users: WorkspaceUser[];
  productCount: number;
  lowStockCount: number;
  stockValue: number;
  serviceOrderCount: number;
  openServiceOrders: number;
  revenue: number;
  revenue30d: number;
  lastActivity: string | null;
}

interface Overview {
  totals: { workspaces: number; users: number; products: number; serviceOrders: number; revenue: number; revenue30d: number };
  workspaces: WorkspaceSummary[];
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const ROLE_LABEL: Record<WorkspaceUser['role'], string> = { admin: 'Admin', editor: 'Operador', viewer: 'Visualizador' };

function timeAgo(iso: string | null) {
  if (!iso) return 'Sem atividade';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `Há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Há ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `Há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR');
}

const Kpi = ({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) => (
  <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      <Icon size={14} aria-hidden="true" /> {label}
    </div>
    <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 tabular-nums dark:text-white">{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
  </div>
);

/** Painel exclusivo do admin geral: todas as oficinas, seus números e usuários. */
export const AdminPanel = () => {
  const { profile, switchWorkspace } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [toDelete, setToDelete] = useState<WorkspaceSummary | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiGet<Overview>('/admin/overview'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeId = profile?.workspace?.id ?? profile?.workspaceId;

  const saveName = async () => {
    if (!renaming || !renaming.name.trim()) return;
    setSavingName(true);
    try {
      await apiPatch(`/admin/workspaces/${renaming.id}`, { name: renaming.name.trim() });
      toast.success('Oficina renomeada.');
      setRenaming(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível renomear.');
    } finally {
      setSavingName(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin/workspaces/${toDelete.id}`, { confirmName });
      toast.success(`Oficina "${toDelete.name}" excluída.`);
      // Estava dentro dela: volta para a própria oficina.
      if (toDelete.id === activeId) {
        setActiveWorkspace(null);
        window.location.reload();
        return;
      }
      setToDelete(null);
      setConfirmName('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setDeleting(false);
    }
  };
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.workspaces ?? [];
    if (!q) return all;
    return all.filter(w => w.name.toLowerCase().includes(q) || w.users.some(u => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)));
  }, [data, search]);

  return (
    <div className="w-full space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-5 dark:border-zinc-800/80">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            <ShieldCheck size={22} className="text-blue-600" aria-hidden="true" /> Painel geral
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Todas as oficinas do sistema. Visível só para o administrador geral.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Atualizar
        </button>
      </div>

      {!data && loading ? (
        <div className="flex min-h-[40vh] items-center justify-center" role="status">
          <Loader2 size={24} className="animate-spin text-zinc-400" aria-hidden="true" />
          <span className="sr-only">Carregando…</span>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Building2} label="Oficinas" value={String(data.totals.workspaces)} />
            <Kpi icon={Users} label="Usuários" value={String(data.totals.users)} />
            <Kpi icon={FileText} label="Ordens de serviço" value={String(data.totals.serviceOrders)} hint={`${data.totals.products} produtos cadastrados`} />
            <Kpi icon={Wallet} label="Faturado (30 dias)" value={brl(data.totals.revenue30d)} hint={`Total: ${brl(data.totals.revenue)}`} />
          </div>

          <div className="relative max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar oficina, nome ou e-mail…"
              aria-label="Buscar oficina"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <ul className="space-y-2.5">
            {list.length === 0 && (
              <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">Nenhuma oficina encontrada.</li>
            )}
            {list.map(w => {
              const isOpen = expanded === w.id;
              const isActive = w.id === activeId;
              const isMine = w.id === profile?.workspaceId;
              const owner = w.users.find(u => u.role === 'admin');
              return (
                <li key={w.id} className={`rounded-xl border bg-white dark:bg-zinc-900 ${isActive ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-zinc-200/80 dark:border-zinc-800'}`}>
                  <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 p-4 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      {renaming?.id === w.id ? (
                        <form onSubmit={e => { e.preventDefault(); saveName(); }} className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={renaming.name}
                            onChange={e => setRenaming({ id: w.id, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') setRenaming(null); }}
                            maxLength={100}
                            aria-label="Novo nome da oficina"
                            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          />
                          <button type="submit" disabled={savingName || !renaming.name.trim()} aria-label="Salvar nome" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/40 cursor-pointer">
                            {savingName ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                          </button>
                          <button type="button" onClick={() => setRenaming(null)} aria-label="Cancelar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                            <X size={15} aria-hidden="true" />
                          </button>
                        </form>
                      ) : (
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-zinc-900 dark:text-white">{w.name}</p>
                        {isMine && <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Sua</span>}
                        {isActive && !isMine && <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Aberta agora</span>}
                      </div>
                      )}
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {owner ? owner.email : 'Sem administrador'} · criada em {new Date(w.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Produtos</p>
                      <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {w.productCount}
                        {w.lowStockCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400" title="Abaixo do estoque mínimo">
                            <AlertTriangle size={11} aria-hidden="true" />{w.lowStockCount}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">OS (abertas)</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{w.serviceOrderCount} <span className="font-normal text-zinc-500">({w.openServiceOrders})</span></p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Faturado 30d</p>
                      <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{brl(w.revenue30d)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Última atividade</p>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{timeAgo(w.lastActivity)}</p>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-1">
                      <button
                        type="button"
                        onClick={() => setRenaming({ id: w.id, name: w.name })}
                        aria-label={`Renomear ${w.name}`}
                        title="Renomear"
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      {!isMine && (
                        <button
                          type="button"
                          onClick={() => { setToDelete(w); setConfirmName(''); }}
                          aria-label={`Excluir ${w.name}`}
                          title="Excluir oficina"
                          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : w.id)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Users size={13} aria-hidden="true" /> {w.users.length}
                        <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => switchWorkspace(w.id)}
                        disabled={isActive}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 cursor-pointer disabled:cursor-default"
                      >
                        <LogIn size={13} aria-hidden="true" /> {isActive ? 'Aberta' : 'Entrar'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                      {w.users.length === 0 ? (
                        <p className="text-xs text-zinc-500">Nenhum usuário.</p>
                      ) : (
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {w.users.map(u => (
                            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-zinc-900 dark:text-white">{u.name}</p>
                                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-semibold">
                                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{ROLE_LABEL[u.role]}</span>
                                {u.status !== 'approved' && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{u.status === 'pending' ? 'Pendente' : 'Recusado'}</span>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-ws-title">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40">
              <Trash2 size={20} aria-hidden="true" />
            </div>
            <h2 id="delete-ws-title" className="text-lg font-bold text-zinc-900 dark:text-white">Excluir "{toDelete.name}"?</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Apaga para sempre os {toDelete.productCount} produtos, {toDelete.serviceOrderCount} ordens de serviço, movimentações, alertas e backups desta oficina.
              Os {toDelete.users.length} usuário(s) dela perdem o login. <strong className="text-zinc-900 dark:text-white">Não dá para desfazer.</strong>
            </p>
            <label htmlFor="confirm-ws-name" className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Digite <span className="font-semibold text-zinc-900 dark:text-white">{toDelete.name}</span> para confirmar
            </label>
            <input
              id="confirm-ws-name"
              autoFocus
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting || confirmName.trim() !== toDelete.name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {deleting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Excluir oficina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
