import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, subscribeChanges } from '../lib/api';

type Role = 'admin' | 'editor' | 'viewer';
interface Signup { id: string; name: string; email: string; createdAt: string }

const ROLES: { id: Role; label: string }[] = [
  { id: 'editor', label: 'Operador' },
  { id: 'viewer', label: 'Visualizador' },
  { id: 'admin', label: 'Administrador' },
];
const NEW_WORKSPACE = '__new__';

function since(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia(s)`;
}

const fieldCls = 'rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

/**
 * Fila de quem criou conta e ainda não está em nenhuma mecânica.
 * - `super`: escolhe qualquer mecânica (ou cria uma nova) e pode recusar.
 * - `owner`: adiciona à própria mecânica (`workspaceId`).
 * Some quando não há ninguém esperando.
 */
export const SignupQueue: React.FC<(
  | { mode: 'super'; workspaces: { id: string; name: string }[] }
  | { mode: 'owner'; workspaceId: string; workspaceName?: string }
) & { onDone?: () => void }> = (props) => {
  const [items, setItems] = useState<Signup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dest, setDest] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, Role>>({});

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<Signup[]>('/signups'));
    } catch {
      /* sem permissão ou offline: a fila só não aparece */
    }
  }, []);

  useEffect(() => {
    load();
    return subscribeChanges((resource) => { if (resource === 'users') load(); });
  }, [load]);

  if (items.length === 0) return null;

  const assign = async (s: Signup) => {
    const target = props.mode === 'owner' ? props.workspaceId : (dest[s.id] ?? props.workspaces[0]?.id ?? NEW_WORKSPACE);
    const isNew = target === NEW_WORKSPACE;
    const name = (newName[s.id] ?? `Oficina de ${s.name}`).trim();
    if (!target || (isNew && !name)) return toast.error('Escolha a mecânica.');
    setBusy(s.id);
    try {
      await apiPost(`/signups/${s.id}/assign`, isNew
        ? { newWorkspaceName: name, role: 'admin' }
        : { workspaceId: target, role: roles[s.id] ?? 'editor' });
      const where = isNew ? name : props.mode === 'owner' ? (props.workspaceName ?? 'sua mecânica') : props.workspaces.find(w => w.id === target)?.name;
      toast.success(`${s.name} agora faz parte de ${where}.`);
      setItems(prev => prev.filter(x => x.id !== s.id));
      props.onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível aprovar.');
      load();
    } finally {
      setBusy(null);
    }
  };

  const reject = async (s: Signup) => {
    setBusy(s.id);
    try {
      await apiPost(`/signups/${s.id}/reject`);
      toast.success(`Cadastro de ${s.name} recusado.`);
      setItems(prev => prev.filter(x => x.id !== s.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível recusar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="signup-queue-title" className="overflow-hidden rounded-xl border border-amber-300/60 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10">
      <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-3 dark:border-amber-900/40">
        <UserPlus size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h2 id="signup-queue-title" className="text-sm font-semibold text-zinc-900 dark:text-white">Cadastros novos aguardando mecânica</h2>
        <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{items.length}</span>
        <p className="ml-auto hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
          {props.mode === 'super' ? 'Escolha a mecânica de cada pessoa e aprove.' : 'Se a pessoa trabalha com você, adicione à sua mecânica.'}
        </p>
      </div>

      <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/30">
        {items.map(s => {
          const target = props.mode === 'super' ? (dest[s.id] ?? props.workspaces[0]?.id ?? NEW_WORKSPACE) : props.workspaceId;
          const isNew = target === NEW_WORKSPACE;
          const working = busy === s.id;
          return (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{s.email} · criou a conta {since(s.createdAt)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {props.mode === 'super' && (
                  <>
                    <label htmlFor={`dest-${s.id}`} className="sr-only">Mecânica de {s.name}</label>
                    <select
                      id={`dest-${s.id}`}
                      value={target}
                      onChange={e => setDest(d => ({ ...d, [s.id]: e.target.value }))}
                      className={`${fieldCls} max-w-[14rem] cursor-pointer`}
                    >
                      {props.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      <option value={NEW_WORKSPACE}>+ Nova mecânica</option>
                    </select>
                    {isNew && (
                      <>
                        <label htmlFor={`name-${s.id}`} className="sr-only">Nome da nova mecânica</label>
                        <input
                          id={`name-${s.id}`}
                          value={newName[s.id] ?? `Oficina de ${s.name}`}
                          onChange={e => setNewName(n => ({ ...n, [s.id]: e.target.value }))}
                          maxLength={100}
                          className={`${fieldCls} w-48`}
                        />
                      </>
                    )}
                  </>
                )}

                {isNew ? (
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">vira Administrador</span>
                ) : (
                  <>
                    <label htmlFor={`role-${s.id}`} className="sr-only">Função de {s.name}</label>
                    <select
                      id={`role-${s.id}`}
                      value={roles[s.id] ?? 'editor'}
                      onChange={e => setRoles(r => ({ ...r, [s.id]: e.target.value as Role }))}
                      className={`${fieldCls} cursor-pointer`}
                    >
                      {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => assign(s)}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {working ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                  {props.mode === 'owner' ? 'Adicionar à minha mecânica' : 'Aprovar'}
                </button>
                {props.mode === 'super' && (
                  <button
                    type="button"
                    onClick={() => reject(s)}
                    disabled={working}
                    aria-label={`Recusar cadastro de ${s.name}`}
                    title="Recusar"
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
