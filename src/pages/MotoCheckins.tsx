import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Camera, Check, ChevronDown, ClipboardCheck, Gauge, ImagePlus, Loader2, Plus, Timer, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, subscribeChanges } from '../lib/api';
import { compressImage } from '../lib/compressImage';
import { HeroStat, PageHero, heroBtnPrimary } from '../components/PageHero';
import { MaintenanceTimer, MotoOSDetail, STATUS_TONE, type MotoOS } from '../components/moto/MotoOSDetail';
import { motoStatusLabel, type MotoStatus } from '../../server/services/motoFlow';

type Side = 'front' | 'back' | 'left' | 'right' | 'odometer';
type Photos = Partial<Record<Side, string>> & { extra?: string[] };
type Checkin = MotoOS;

const SIDES: { key: Side; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Traseira' },
  { key: 'left', label: 'Lado esquerdo' },
  { key: 'right', label: 'Lado direito' },
  { key: 'odometer', label: 'Painel (km)' },
];
const MODELS = ['Haojue DK 160', 'Haojue DK 150', 'Yamaha Factor 150', 'Avelloz', 'Shineray SHI 175', 'Shineray SHI 250'];
const MAX_EXTRA = 4;

const fieldClass = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600';
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Botão de foto: no celular abre a câmera traseira direto. */
const PhotoSlot: React.FC<{ label: string; value?: string; busy?: boolean; className?: string; onPick: (f: File) => void; onClear: () => void }> = ({ label, value, busy, className = 'aspect-[4/3]', onPick, onClear }) => (
  <div className="relative">
    <label className={`group flex ${className} cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-600/40 ${value ? 'border-emerald-500/60' : 'border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:bg-blue-500/10'}`}>
      {busy ? <Loader2 size={18} className="animate-spin" aria-label="Processando foto" />
        : value ? <img src={value} alt={label} className="h-full w-full object-cover" />
        : <><Camera size={22} aria-hidden="true" className="transition-transform group-hover:scale-110" /><span className="px-1 text-center leading-tight">{label}</span></>}
      <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Foto: ${label}`}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </label>
    {value && (
      <>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 rounded-b-xl bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[10px] font-semibold text-white">
          <Check size={11} className="text-emerald-400" aria-hidden="true" />{label}
        </span>
        <button type="button" onClick={onClear} aria-label={`Remover foto: ${label}`} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 cursor-pointer">
          <X size={11} aria-hidden="true" />
        </button>
      </>
    )}
  </div>
);

/** Etapa numerada do formulário. */
const Step: React.FC<{ n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ n, title, aside, children }) => (
  <fieldset className="space-y-3">
    <legend className="flex w-full items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{n}</span>
      {title}
      {aside && <span className="ml-auto text-xs font-medium text-zinc-500">{aside}</span>}
    </legend>
    {children}
  </fieldset>
);

const EMPTY = { plate: '', model: '', unitId: '', km: '', notes: '' };

/** Check-list de recebimento: registra como a moto chegou (fotos de todos os lados, km e observações). */
export const MotoCheckins = () => {
  const { canCheckin, allUnits, units, profile, canManageOS, canManageInventory, canApproveOS } = useApp();
  const myUnit = units.find(u => u.id === profile?.unitId);
  const [list, setList] = useState<Checkin[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [photos, setPhotos] = useState<Photos>({});
  const [busy, setBusy] = useState<string | null>(null); // foto sendo processada ou 'save'
  const [viewing, setViewing] = useState<Checkin | null>(null);

  const [filter, setFilter] = useState<'fila' | 'andamento' | 'finalizadas' | 'todas'>('fila');

  const load = useCallback(() => apiGet<Checkin[]>('/moto-checkins').then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  // Lembra a OS aberta: atualizar a página (F5) volta para ela.
  const OPEN_KEY = 'munago_open_moto_os';
  useEffect(() => {
    let id: string | null = null;
    try { id = sessionStorage.getItem(OPEN_KEY); } catch { /* armazenamento indisponível */ }
    if (id) apiGet<Checkin>(`/moto-checkins/${id}`).then(setViewing).catch(() => { try { sessionStorage.removeItem(OPEN_KEY); } catch { /* idem */ } });
    // Aviso "Abrir" com a tela já aberta
    const onOpen = (e: Event) => apiGet<Checkin>(`/moto-checkins/${(e as CustomEvent<string>).detail}`).then(setViewing).catch(() => toast.error('Não foi possível abrir a OS.'));
    window.addEventListener('open-moto-os', onOpen);
    // Pede permissão para avisar mesmo com a aba em segundo plano
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    // Trocar de menu fecha a OS (o F5 não desmonta a tela, então lá ela continua lembrada).
    return () => {
      window.removeEventListener('open-moto-os', onOpen);
      try { sessionStorage.removeItem(OPEN_KEY); } catch { /* idem */ }
    };
  }, []);
  useEffect(() => {
    try {
      if (viewing) sessionStorage.setItem(OPEN_KEY, viewing.id);
      else sessionStorage.removeItem(OPEN_KEY);
    } catch { /* armazenamento indisponível */ }
  }, [viewing?.id]);
  // Outra pessoa avançou uma OS: atualiza a lista na hora.
  useEffect(() => subscribeChanges(r => { if (r === 'motoCheckins') load(); }), [load]);

  // "Minha fila": as etapas que dependem do meu perfil
  const myStatuses = useMemo(() => new Set<MotoStatus>([
    ...(canManageOS ? ['recebida', 'autorizada', 'em_manutencao'] as const : []),
    ...(canManageInventory ? ['aguardando_estoque', 'aguardando_peca'] as const : []),
    ...(canApproveOS ? ['aguardando_autorizacao'] as const : []),
  ]), [canManageOS, canManageInventory, canApproveOS]);
  const closed = (c: Checkin) => c.status === 'finalizada' || c.status === 'recusada';
  const shown = (list ?? []).filter(c =>
    filter === 'fila' ? myStatuses.has(c.status) : filter === 'andamento' ? !closed(c) : filter === 'finalizadas' ? closed(c) : true);
  const counts = {
    fila: (list ?? []).filter(c => myStatuses.has(c.status)).length,
    andamento: (list ?? []).filter(c => !closed(c)).length,
    finalizadas: (list ?? []).filter(closed).length,
    todas: list?.length ?? 0,
  };

  const pick = async (slot: Side | 'extra', file: File) => {
    setBusy(slot);
    try {
      const url = await compressImage(file);
      setPhotos(p => slot === 'extra' ? { ...p, extra: [...(p.extra ?? []), url].slice(0, MAX_EXTRA) } : { ...p, [slot]: url });
    } catch {
      toast.error('Não consegui ler essa foto. Tente outra.');
    } finally {
      setBusy(null);
    }
  };

  const missing = SIDES.filter(s => !photos[s.key]).map(s => s.label);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (missing.length) { toast.error(`Falta foto: ${missing.join(', ')}.`); return; }
    setBusy('save');
    try {
      await apiPost('/moto-checkins', {
        plate: form.plate, model: form.model, unitId: form.unitId || undefined, km: Number(form.km), notes: form.notes || undefined, photos,
      });
      toast.success('Entrada da moto registrada.');
      setForm(null);
      setPhotos({});
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(null);
    }
  };

  const open = async (c: Checkin) => {
    setViewing(c);
    window.scrollTo({ top: 0 });
    try { setViewing(await apiGet<Checkin>(`/moto-checkins/${c.id}`)); } catch { toast.error('Não foi possível abrir as fotos.'); }
  };

  const today = (list ?? []).filter(c => new Date(c.createdAt).toDateString() === new Date().toDateString()).length;
  const working = (list ?? []).filter(c => c.status === 'em_manutencao').length;

  // OS aberta ocupa a aba inteira (sem pop-up); "Voltar" retorna à lista.
  if (viewing) {
    return (
      <MotoOSDetail
        os={viewing}
        onClose={() => setViewing(null)}
        onChanged={os => { setViewing(os); setList(l => l?.map(x => x.id === os.id ? { ...x, ...os, photos: undefined } : x) ?? l); }}
      />
    );
  }

  return (
    <div className="w-full space-y-5 pb-24 lg:pb-6">
      <PageHero
        icon={ClipboardCheck}
        title="OS de motos"
        subtitle="Da chegada da moto até a entrega: check-list, mecânico, estoque, CS e manutenção."
        actions={canCheckin && (
          <button type="button" onClick={() => { setForm({ ...EMPTY }); setPhotos({}); }} className={heroBtnPrimary}>
            <Plus size={15} aria-hidden="true" /> Registrar entrada
          </button>
        )}
        statsClassName="grid-cols-2 @3xl:grid-cols-4"
      >
        <HeroStat icon={ClipboardCheck} iconClass="bg-blue-500" label="Minha fila" value={counts.fila} hint="esperando você" selected={filter === 'fila'} onClick={() => setFilter('fila')} />
        <HeroStat icon={Wrench} iconClass="bg-amber-500" label="Em andamento" value={counts.andamento} hint="ainda não finalizadas" selected={filter === 'andamento'} onClick={() => setFilter('andamento')} />
        <HeroStat icon={Timer} iconClass="bg-emerald-500" label="Em manutenção" value={working} hint="cronômetro rodando" />
        <HeroStat icon={Bike} iconClass="bg-violet-500" label="Entradas hoje" value={today} hint={`${counts.todas} no total`} selected={filter === 'todas'} onClick={() => setFilter('todas')} />
      </PageHero>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/90" aria-label="OS de motos">
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50/70 p-1.5 dark:border-zinc-800 dark:bg-zinc-900" role="group" aria-label="Filtrar">
          {([['fila', 'Minha fila'], ['andamento', 'Em andamento'], ['finalizadas', 'Finalizadas'], ['todas', 'Todas']] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${filter === v ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}>
              {label} <span className="ml-1 tabular-nums text-[10px] text-zinc-400">{counts[v]}</span>
            </button>
          ))}
        </div>
        {list === null ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" aria-label="Carregando" /></div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">{filter === 'fila' ? 'Nada esperando você agora.' : list.length === 0 ? 'Nenhuma moto registrada ainda. Toque em "Registrar entrada" quando uma moto chegar.' : 'Nenhuma OS neste filtro.'}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{c.model}</span>
                      <span className="shrink-0 font-mono text-[11px] uppercase text-zinc-500">{c.plate}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {c.km.toLocaleString('pt-BR')} km{c.unit ? ` · ${c.unit}` : ''} · {c.createdByName}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[c.status]}`}>{motoStatusLabel(c)}</span>
                    {c.startedAt
                      ? <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Timer size={11} aria-hidden="true" /><MaintenanceTimer startedAt={c.startedAt} finishedAt={c.finishedAt} estimatedMinutes={c.estimatedMinutes} /></span>
                      : <span className="text-[11px] tabular-nums text-zinc-500">{dateTime(c.createdAt)}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Nova entrada: primeiro identifica a moto, depois as fotos */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
          <form onSubmit={save} className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl">
            <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Bike size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <h2 id="checkin-title" className="text-base font-bold text-zinc-900 dark:text-white">Entrada da moto</h2>
                <p className="text-xs text-zinc-500">Registre como a moto chegou na oficina.</p>
              </div>
              <button type="button" onClick={() => setForm(null)} aria-label="Fechar" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="grid content-start gap-6 overflow-y-auto px-5 py-5 lg:grid-cols-2 lg:gap-x-8">
              {/* Computador: dados e observações à esquerda, fotos à direita. Celular: 1, 2, 3 em sequência. */}
              <div className="space-y-6 lg:col-start-1">
                <Step n={1} title="Dados da moto">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Placa
                      <input required value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} maxLength={10} className={`${fieldClass} mt-1 font-mono uppercase tracking-wider`} placeholder="ABC1D23" autoComplete="off" />
                    </label>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Modelo
                      <span className="relative mt-1 block">
                        <select required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={`${fieldClass} appearance-none pr-9 ${form.model ? '' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          <option value="" disabled>Escolha o modelo</option>
                          {MODELS.map(m => <option key={m} value={m} className="text-zinc-900 dark:text-zinc-100">{m}</option>)}
                        </select>
                        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                      </span>
                    </label>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Quilometragem
                      <span className="relative mt-1 block">
                        <Gauge size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                        <input required type="number" inputMode="numeric" min={0} max={2000000} value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} className={`${fieldClass} pl-9 pr-10 tabular-nums`} placeholder="0" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">km</span>
                      </span>
                    </label>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Unidade
                      {allUnits ? (
                        <span className="relative mt-1 block">
                          <select value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })} className={`${fieldClass} appearance-none pr-9 ${form.unitId ? '' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            <option value="">Sem unidade</option>
                            {units.map(u => <option key={u.id} value={u.id} className="text-zinc-900 dark:text-zinc-100">{u.name}</option>)}
                          </select>
                          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className={`${fieldClass} mt-1 block cursor-default bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300`}>{myUnit?.name ?? 'Sem unidade (fale com o admin)'}</span>
                      )}
                    </label>
                  </div>
                </Step>
              </div>
              <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <Step n={2} title="Fotos da moto" aside={`${SIDES.length - missing.length} de ${SIDES.length}`}>
                  <div className="grid grid-cols-2 gap-3">
                    {SIDES.map(sd => (
                      <div key={sd.key} className={sd.key === 'odometer' ? 'col-span-2' : ''}><PhotoSlot label={sd.label} value={photos[sd.key]} busy={busy === sd.key}
                        className={sd.key === 'odometer' ? 'aspect-[16/6]' : 'aspect-[4/3]'}
                        onPick={f => pick(sd.key, f)} onClear={() => setPhotos(p => ({ ...p, [sd.key]: undefined }))} /></div>
                    ))}
                  </div>
                </Step>
              </div>
              <div className="lg:col-start-1">
                <Step n={3} title="Avarias e observações" aside="opcional">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Observações
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} maxLength={2000} rows={4} className={`${fieldClass} mt-1 resize-none`} placeholder="Riscos, peças faltando, barulhos, o que o cliente relatou…" />
                  </label>
                  <div>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Fotos de avarias</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(photos.extra ?? []).map((url, i) => (
                        <div key={i} className="w-24"><PhotoSlot label={`Avaria ${i + 1}`} value={url} className="aspect-square" onPick={() => {}} onClear={() => setPhotos(p => ({ ...p, extra: p.extra?.filter((_, j) => j !== i) }))} /></div>
                      ))}
                      {(photos.extra?.length ?? 0) < MAX_EXTRA && (
                        <label className="flex aspect-square w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-[11px] font-medium text-zinc-500 transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:bg-blue-500/10 focus-within:ring-2 focus-within:ring-blue-600/40">
                          {busy === 'extra' ? <Loader2 size={18} className="animate-spin" aria-label="Processando foto" /> : <><ImagePlus size={18} aria-hidden="true" />Adicionar</>}
                          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Adicionar foto de avaria"
                            onChange={e => { const f = e.target.files?.[0]; if (f) pick('extra', f); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                  </div>
                </Step>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
                  <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${((SIDES.length - missing.length) / SIDES.length) * 100}%` }} />
                </div>
                <span className="text-xs text-zinc-500">{missing.length ? `Faltam ${missing.length} foto${missing.length > 1 ? 's' : ''}` : 'Fotos completas'}</span>
              </div>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {busy === 'save' && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} Salvar entrada
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
