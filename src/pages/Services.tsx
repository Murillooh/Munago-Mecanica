import React, { useState } from 'react';
import { DollarSign, Loader2, Pencil, Percent, Plus, Trash2, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, type Service } from '../context/AppContext';
import { apiDelete, apiPatch, apiPost } from '../lib/api';
import { serviceRepasse } from '../../server/services/revenueSplit';
import { HeroStat, PageHero, heroBtnPrimary } from '../components/PageHero';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fieldClass = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

type Draft = { id?: string; name: string; price: string; repasseType: Service['repasseType']; repasseValue: string };
const EMPTY: Draft = { name: '', price: '', repasseType: 'fixed', repasseValue: '' };

const repasseLabel = (s: Pick<Service, 'repasseType' | 'repasseValue'>) =>
  s.repasseType === 'percent' ? `${s.repasseValue.toLocaleString('pt-BR')}%` : brl.format(s.repasseValue);

/** Catálogo de serviços da mecânica: preço cobrado e repasse para a empresa (R$ fixo ou %). */
export const Services = () => {
  const { services, canManageOS } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  const price = Number(draft?.price || 0);
  const value = Number(draft?.repasseValue || 0);
  const preview = draft ? serviceRepasse(price, 1, draft.repasseType, value) : 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const body = { name: draft.name.trim(), price, repasseType: draft.repasseType, repasseValue: value };
    try {
      if (draft.id) await apiPatch(`/services/${draft.id}`, body);
      else await apiPost('/services', body);
      toast.success(draft.id ? 'Serviço atualizado.' : 'Serviço cadastrado.');
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o serviço.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await apiDelete(`/services/${toDelete.id}`);
      toast.success('Serviço excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="w-full space-y-5 pb-24 lg:pb-6">
      <PageHero
        icon={Wrench}
        title="Serviços"
        subtitle="Valor de cada serviço e quanto vai para a empresa. Na OS, tudo entra automático."
        actions={canManageOS && (
          <button type="button" onClick={() => setDraft({ ...EMPTY })} className={heroBtnPrimary}>
            <Plus size={15} aria-hidden="true" /> Novo serviço
          </button>
        )}
        statsClassName="grid-cols-1 sm:grid-cols-3"
      >
        <HeroStat icon={Wrench} iconClass="bg-blue-500" label="Serviços cadastrados" value={services.length} hint="no catálogo da oficina" />
        <HeroStat
          icon={DollarSign} iconClass="bg-emerald-500" label="Valor médio"
          value={brl.format(services.length ? services.reduce((a, s) => a + s.price, 0) / services.length : 0)}
          hint="cobrado do cliente por serviço"
        />
        <HeroStat
          icon={Percent} iconClass="bg-violet-500" label="Repasse médio"
          value={brl.format(services.length ? services.reduce((a, s) => a + serviceRepasse(s.price, 1, s.repasseType, s.repasseValue), 0) / services.length : 0)}
          hint="para a empresa por serviço"
        />
      </PageHero>

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
          <Wrench size={24} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nenhum serviço cadastrado</p>
          <p className="max-w-sm text-xs text-zinc-500">Cadastre os serviços que a oficina faz (ex.: troca de óleo, revisão) com o valor e o repasse para a empresa.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {services.map(s => {
            const repasse = serviceRepasse(s.price, 1, s.repasseType, s.repasseValue);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Repasse {repasseLabel(s)} · mecânica recebe {brl.format(s.price - repasse)}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{brl.format(s.price)}</p>
                {canManageOS && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setDraft({ id: s.id, name: s.name, price: String(s.price), repasseType: s.repasseType, repasseValue: String(s.repasseValue) })} aria-label={`Editar ${s.name}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setToDelete(s)} aria-label={`Excluir ${s.name}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="service-form-title">
          <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h2 id="service-form-title" className="text-lg font-bold text-zinc-900 dark:text-white">{draft.id ? 'Editar serviço' : 'Novo serviço'}</h2>
              <button type="button" onClick={() => setDraft(null)} aria-label="Fechar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <label htmlFor="svc-name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome do serviço</label>
              <input id="svc-name" required maxLength={200} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Troca de óleo" className={fieldClass} />
            </div>

            <div className="space-y-1">
              <label htmlFor="svc-price" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor cobrado do cliente (R$)</label>
              <input id="svc-price" required type="number" min={0} step="0.01" inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="100,00" className={`${fieldClass} font-mono`} />
            </div>

            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repasse para a empresa</legend>
              <div className="flex gap-2">
                <div role="radiogroup" aria-label="Tipo de repasse" className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                  {([['fixed', 'R$'], ['percent', '%']] as const).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={draft.repasseType === t}
                      onClick={() => setDraft({ ...draft, repasseType: t })}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${draft.repasseType === t ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label htmlFor="svc-repasse" className="sr-only">Valor do repasse</label>
                <input
                  id="svc-repasse"
                  required
                  type="number"
                  min={0}
                  max={draft.repasseType === 'percent' ? 100 : price || undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.repasseValue}
                  onChange={e => setDraft({ ...draft, repasseValue: e.target.value })}
                  placeholder={draft.repasseType === 'percent' ? '10' : '10,00'}
                  className={`${fieldClass} font-mono`}
                />
              </div>
            </fieldset>

            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300" aria-live="polite">
              A cada serviço: <strong className="text-zinc-900 dark:text-white">{brl.format(Math.max(0, price - preview))}</strong> para a mecânica e{' '}
              <strong className="text-zinc-900 dark:text-white">{brl.format(preview)}</strong> para a empresa.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
                {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="service-delete-title">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 id="service-delete-title" className="text-lg font-bold text-zinc-900 dark:text-white">Excluir "{toDelete.name}"?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">As OS que já usaram este serviço não mudam.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setToDelete(null)} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Cancelar</button>
              <button type="button" onClick={remove} className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
