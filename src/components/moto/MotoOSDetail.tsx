import React, { useEffect, useState } from 'react';
import type { Product } from '../../context/AppContext';
import { ArrowLeft, KeyRound, Camera, Check, ChevronLeft, ChevronRight, Expand, FileText, Loader2, Mail, MessageCircle, Minus, Package, Paperclip, Play, Plus, Search, Send, ShieldCheck, Square, Wrench, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../lib/api';
import { compressImage } from '../../lib/compressImage';
import { MAX_ESTIMATE_MINUTES, MOTO_ACTIONS, MOTO_STEPS, motoStatusLabel, motoStep, formatDuration, timeStage, type MotoAction, type MotoEvent, type MotoItem, type MotoStatus } from '../../../server/services/motoFlow';

export interface MotoOS {
  id: string; plate: string; model: string; km: number; notes: string | null;
  customerName: string | null; customerPhone: string | null; franchiseName: string | null;
  status: MotoStatus; items: MotoItem[]; events: MotoEvent[];
  startedAt: string | null; finishedAt: string | null; estimatedMinutes: number | null;
  createdByName: string; createdAt: string;
  photos?: Partial<Record<'front' | 'back' | 'left' | 'right' | 'odometer', string>> & { extra?: string[]; final?: string[]; authProof?: { name: string; url: string } };
}

const PHOTO_LABELS = [['front', 'Frente'], ['back', 'Traseira'], ['left', 'Lado esquerdo'], ['right', 'Lado direito'], ['odometer', 'Painel (km)']] as const;
const fieldClass = 'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600';
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Cor de cada etapa (badge da lista e do detalhe). */
export const STATUS_TONE: Record<MotoStatus, string> = {
  recebida: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  aguardando_estoque: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aguardando_peca: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  aguardando_autorizacao: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  autorizada: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  em_manutencao: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  finalizada: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  recusada: 'bg-red-500/15 text-red-700 dark:text-red-300',
  entregue: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};


/** Milissegundos de manutenção, atualizando a cada segundo enquanto roda. */
/** Escolhe a peça do estoque pesquisando por código ou nome. Sem resultado, Enter usa o texto como código. */
function PartPicker({ code, products, onPick }: { code: string; products: Product[]; onPick: (code: string, name?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const found = (term ? products.filter(p => p.sku?.toLowerCase().includes(term) || p.name.toLowerCase().includes(term)) : products)
    .filter(p => p.sku).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 50);
  const pick = (c: string, name?: string) => { onPick(c, name); setOpen(false); setQ(''); };
  return (
    <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button type="button" aria-label="Código da peça" aria-expanded={open} onClick={() => setOpen(!open)}
        className={`${fieldClass} truncate text-left cursor-pointer ${code ? 'font-mono' : 'text-zinc-400 dark:text-zinc-600'}`}>
        {code || 'Código'}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-700">
            <Search size={14} className="shrink-0 text-zinc-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar código ou peça" aria-label="Buscar peça"
              className="w-full bg-transparent py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter') { e.preventDefault(); if (found[0]) pick(found[0].sku!, found[0].name); else if (term) pick(q.trim().toUpperCase()); }
              }} />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {found.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => pick(p.sku!, p.name)} className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                  <span className="shrink-0 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{p.sku}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{p.name}</span>
                </button>
              </li>
            ))}
            {!found.length && <li className="px-3 py-2 text-xs text-zinc-500">{term ? <>Nenhuma peça. Enter usa <b className="font-mono">{q.trim().toUpperCase()}</b> como código.</> : 'Estoque sem peças cadastradas.'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function useElapsed(startedAt: string | null, finishedAt: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, finishedAt]);
  return startedAt ? (finishedAt ? new Date(finishedAt).getTime() : now) - new Date(startedAt).getTime() : 0;
}

const clockOf = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Tempo correndo (ou o total, se já terminou), com o emoji da fase do prazo. */
export const MaintenanceTimer: React.FC<{ startedAt: string | null; finishedAt: string | null; estimatedMinutes?: number | null; className?: string }> = ({ startedAt, finishedAt, estimatedMinutes, className = '' }) => {
  const ms = useElapsed(startedAt, finishedAt);
  if (!startedAt) return null;
  const stage = estimatedMinutes ? timeStage(ms, estimatedMinutes) : null;
  return (
    <span className={`font-mono tabular-nums ${className}`} title={stage?.label}>
      {stage && <span className="mr-1 font-sans" aria-label={stage.label}>{finishedAt && !stage.late ? '✅' : stage.emoji}</span>}
      {finishedAt ? formatDuration(ms) : clockOf(ms)}
    </span>
  );
};

const BAR: Record<string, string> = { green: 'bg-emerald-500', yellow: 'bg-yellow-400', orange: 'bg-orange-500', red: 'bg-red-500' };
const STAGE_TEXT: Record<string, string> = {
  green: 'text-emerald-600 dark:text-emerald-400', yellow: 'text-yellow-600 dark:text-yellow-400', orange: 'text-orange-600 dark:text-orange-400', red: 'text-red-600 dark:text-red-400',
};

/** Painel do prazo: fase com emoji, cronômetro grande e barra de quanto do tempo já foi usado. */
const DeadlinePanel: React.FC<{ os: MotoOS }> = ({ os }) => {
  const ms = useElapsed(os.startedAt, os.finishedAt);
  if (!os.startedAt) return null;
  const est = os.estimatedMinutes;
  const stage = est ? timeStage(ms, est) : null;
  const over = est ? ms - est * 60_000 : 0;
  const steps = [['🟢', 'No prazo'], ['🟡', 'Metade'], ['🟠', 'Perto'], ['🔴', 'Atrasado']] as const;
  const active = stage ? ['green', 'yellow', 'orange', 'red'].indexOf(stage.tone) : -1;
  return (
    <div className="space-y-3 text-center">
      {stage ? (
        <p className={`text-sm font-bold ${STAGE_TEXT[stage.tone]}`}>
          <span className="mr-1.5 text-xl align-middle">{os.finishedAt && !stage.late ? '✅' : stage.emoji}</span>
          {os.finishedAt ? (stage.late ? `Terminou ${formatDuration(over)} atrasado` : 'Terminou no prazo') : stage.label}
        </p>
      ) : <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Manutenção em andamento</p>}
      <p className="font-mono text-4xl font-bold tabular-nums text-zinc-900 dark:text-white">{os.finishedAt ? formatDuration(ms) : clockOf(ms)}</p>
      {stage && est && (
        <>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(stage.pct, 1) * 100)} aria-label="Tempo usado do prazo">
            <div className={`h-full rounded-full transition-[width] duration-1000 ${BAR[stage.tone]}`} style={{ width: `${Math.min(stage.pct, 1) * 100}%` }} />
          </div>
          <p className="text-xs text-zinc-500">
            {stage.late ? <>Passou <b className="text-red-600 dark:text-red-400">{formatDuration(over)}</b> do prazo de {formatDuration(est * 60_000)}</>
              : <>{Math.round(stage.pct * 100)}% do prazo de {formatDuration(est * 60_000)}{!os.finishedAt && <> · faltam <b>{formatDuration(-over)}</b></>}</>}
          </p>
          <ol className="grid grid-cols-4 gap-1" aria-label="Fases do prazo">
            {steps.map(([emoji, label], i) => (
              <li key={label} className={`rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors ${i === active ? 'bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700' : 'opacity-40'}`}>
                <span className="block text-base">{emoji}</span>{label}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

/** Foto em tela cheia, com setas (teclado ← →) para passar e Esc para fechar. */
const PhotoViewer: React.FC<{ photos: (readonly [string, string])[]; index: number; onIndex: (i: number | null) => void }> = ({ photos, index, onIndex }) => {
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onIndex(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const [label, url] = photos[index];
  const nav = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 cursor-pointer';
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={`Foto: ${label}`} onClick={() => onIndex(null)}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">{label} <span className="ml-1 text-xs font-normal text-white/60">{index + 1} de {photos.length}</span></span>
        <button type="button" onClick={() => onIndex(null)} aria-label="Fechar" className="rounded-full p-2 hover:bg-white/10 cursor-pointer"><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6" onClick={e => e.stopPropagation()}>
        <img src={url} alt={label} className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className={`${nav} left-3`}><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className={`${nav} right-3`}><ChevronRight size={22} /></button>
          </>
        )}
      </div>
    </div>
  );
};

/** Nome de cada passo na linha do tempo, com quem fez em cima. */
const EVENT_LABEL: Record<MotoEvent['type'], { title: string; who: string }> = {
  recebida: { title: 'Recebeu a moto e fez o check-list', who: 'Front' },
  diagnose: { title: 'Fez o diagnóstico e pediu as peças', who: 'Mecânico' },
  stock_ok: { title: 'Confirmou as peças no estoque', who: 'Estoque' },
  stock_missing: { title: 'Informou que falta peça', who: 'Estoque' },
  request_auth: { title: 'Enviou o pedido de autorização ao franqueado', who: 'Time CS' },
  authorize: { title: 'Franqueado aprovou: autorização anexada', who: 'Time CS' },
  reject: { title: 'Serviço recusado', who: 'Time CS' },
  start: { title: 'Iniciou a manutenção', who: 'Mecânico' },
  finish: { title: 'Finalizou a manutenção', who: 'Mecânico' },
  deliver: { title: 'Entregou a moto ao locatário', who: 'Front' },
};
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** Texto do pedido de autorização (e-mail e WhatsApp). */
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Orçamento enviado ao franqueado: preço de cada item e a mão de obra. */
interface Quote { prices: number[]; labor: number }
const quoteTotal = (os: MotoOS, q: Quote) => os.items.reduce((a, it, i) => a + it.quantity * (q.prices[i] || 0), 0) + (q.labor || 0);

function authRequestText(os: MotoOS, q: Quote, to?: string | null, base?: string) {
  const lines = [
    `Olá${to ? `, ${to}` : ''}! Precisamos da sua autorização para a manutenção desta moto:`,
    ...(os.franchiseName ? [`Franquia: ${os.franchiseName}`] : []),
    ...(os.customerName ? [`Locatário: ${os.customerName}`] : []),
    '',
    `Moto: ${os.model} · placa ${os.plate}`,
    `Km: ${os.km.toLocaleString('pt-BR')}${base ? ` · Base: ${base}` : ''}`,
    '',
    'Serviços e peças:',
    ...os.items.map((i, k) => `- ${i.quantity}x ${i.description}${i.code ? ` (${i.code})` : ''}${i.purpose ? ` (${i.purpose})` : ''}: ${brl(i.quantity * (q.prices[k] || 0))}`),
    ...(q.labor ? [`- Mão de obra: ${brl(q.labor)}`] : []),
    '',
    `VALOR TOTAL DA MANUTENÇÃO: ${brl(quoteTotal(os, q))}`,
    ...(os.estimatedMinutes ? [`Tempo estimado: ${formatDuration(os.estimatedMinutes * 60_000)}`] : []),
    '',
    'Por favor, responda com "AUTORIZO" para liberarmos o serviço.',
  ];
  return lines.join('\n');
}

/** WhatsApp sem API: número só com dígitos, com DDI 55 se vier só DDD + número. */
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length <= 11 ? `55${d}` : d; };

/** Abre um comprovante (data URL) numa aba nova: o navegador bloqueia data: direto, então vira blob. */
async function openProof(url: string) {
  const blob = await (await fetch(url)).blob();
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

const EVENT_ICON: Record<MotoEvent['type'], React.ElementType> = {
  recebida: Check, diagnose: Wrench, stock_ok: Package, stock_missing: Package, request_auth: Send, authorize: ShieldCheck, reject: XCircle, start: Play, finish: Square, deliver: KeyRound,
};

/** OS da moto aberta na própria aba: linha do tempo em destaque, etapas, ação da vez (conforme o perfil), pedido e fotos. */
export const MotoOSDetail: React.FC<{ os: MotoOS; onClose: () => void; onChanged: (os: MotoOS) => void }> = ({ os, onClose, onChanged }) => {
  const { canManageOS, canManageInventory, canApproveOS, canCheckin, products, settings } = useApp();
  // Franqueado da Base (Configurações)
  const unit = { franchiseeName: settings.franchiseeName, franchiseeEmail: settings.franchiseeEmail, franchiseePhone: settings.franchiseePhone };
  const [contact, setContact] = useState({ email: '', phone: '' });
  useEffect(() => setContact({ email: unit?.franchiseeEmail ?? '', phone: unit?.franchiseePhone ?? '' }), [unit?.franchiseeEmail, unit?.franchiseePhone]);
  const [proof, setProof] = useState<{ name: string; url: string } | null>(null);
  const [readingProof, setReadingProof] = useState(false);
  // Preço de cada item: vem do cadastro da peça no estoque (pelo código), bloqueado para edição
  const [labor, setLabor] = useState(0);
  const quote: Quote = { prices: os.items.map(it => (it.code ? products.find(p => p.sku?.toLowerCase() === it.code.toLowerCase())?.price : undefined) ?? 0), labor };
  const [busy, setBusy] = useState<MotoAction | null>(null);
  const [zoom, setZoom] = useState<{ set: 'arrival' | 'final'; i: number } | null>(null);
  const [finalPhotos, setFinalPhotos] = useState<string[]>([]);
  const [estimate, setEstimate] = useState(60);
  const [shooting, setShooting] = useState(false);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<MotoItem[]>([{ code: '', description: '', quantity: 1, purpose: '' }]);
  const [available, setAvailable] = useState<boolean[]>(() => os.items.map(i => i.available ?? false));
  useEffect(() => { setAvailable(os.items.map(i => i.available ?? false)); setNote(''); }, [os.id, os.status, os.items]);

  const stockOf = (code: string) => (code ? products.find(p => p.sku?.toLowerCase() === code.toLowerCase()) : undefined);

  const run = async (action: MotoAction, extra: object = {}) => {
    setBusy(action);
    try {
      const updated = await apiPost<MotoOS>(`/moto-checkins/${os.id}/actions`, { action, note: note.trim() || undefined, ...extra });
      toast.success(MOTO_ACTIONS[action].done + '.');
      // A resposta não traz as fotos (pesadas): junta as finais que acabamos de enviar.
      onChanged({ ...os, ...updated, photos: !os.photos ? os.photos : action === 'finish' ? { ...os.photos, final: finalPhotos } : action === 'authorize' && proof ? { ...os.photos, authProof: proof } : os.photos });
      if (action === 'authorize') setProof(null);
      if (action === 'finish') setFinalPhotos([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy(null);
    }
  };

  const stepIndex = motoStep(os);
  const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer';
  const noteField = (placeholder: string) => (
    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000} placeholder={placeholder} className={`${fieldClass} resize-none`} />
  );

  // Ação da vez, só para quem faz esta etapa
  let action: React.ReactNode = null;
  if (os.status === 'recebida' && canManageOS) {
    const valid = items.filter(i => i.description.trim());
    action = (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">O que precisa ser feito na moto?</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[5.5rem_1fr_4.5rem_auto] gap-2 sm:grid-cols-[7rem_1fr_4.5rem_1fr_auto]">
            <PartPicker code={it.code} products={products}
              onPick={(code, name) => setItems(items.map((x, j) => j === i ? { ...x, code, description: name ?? (x.description || stockOf(code)?.name || '') } : x))} />
            <input aria-label="Descrição" value={it.description} placeholder="Peça ou serviço" className={fieldClass} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <input aria-label="Quantidade" type="number" min={1} value={it.quantity} className={`${fieldClass} tabular-nums`} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))} />
            <input aria-label="Finalidade" value={it.purpose} placeholder="Finalidade (ex.: freio gasto)" className={`${fieldClass} col-span-3 sm:col-span-1`} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, purpose: e.target.value } : x))} />
            <button type="button" aria-label="Remover linha" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} className="row-start-1 col-start-4 sm:col-start-5 self-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-zinc-800 cursor-pointer"><Minus size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { code: '', description: '', quantity: 1, purpose: '' }])} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer dark:text-blue-400"><Plus size={14} /> Adicionar item</button>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Tempo estimado do serviço (prazo, até 1 h 30 min)</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[30, 45, 60, 75, 90].map(m => (
              <button key={m} type="button" aria-pressed={estimate === m} onClick={() => setEstimate(m)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${estimate === m ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-200 text-zinc-600 hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-300'}`}>
                {formatDuration(m * 60_000)}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">ou
              <input type="number" min={5} max={MAX_ESTIMATE_MINUTES} step={5} value={estimate} onChange={e => setEstimate(Math.min(MAX_ESTIMATE_MINUTES, Math.max(5, Number(e.target.value) || 5)))} className={`${fieldClass} w-20 py-1.5 tabular-nums`} aria-label="Minutos estimados" /> min
            </label>
          </div>
        </div>
        {noteField('Observação para o estoque (opcional)')}
        <button type="button" disabled={!valid.length || busy !== null} onClick={() => run('diagnose', { items: valid, estimatedMinutes: estimate })} className={`${btn} w-full bg-blue-600 text-white hover:bg-blue-700`}>
          {busy === 'diagnose' && <Loader2 size={15} className="animate-spin" />} Enviar para o estoque
        </button>
      </div>
    );
  } else if ((os.status === 'aguardando_estoque' || os.status === 'aguardando_peca') && canManageInventory) {
    const all = available.every(Boolean);
    action = (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{os.status === 'aguardando_peca' ? 'A peça chegou?' : 'Tem as peças em estoque?'}</p>
        {noteField(all ? 'Observação (opcional)' : 'O que está faltando? (vai para a linha do tempo)')}
        <div className="flex flex-wrap gap-2">
          {os.status === 'aguardando_estoque' && (
            <button type="button" disabled={all || busy !== null} onClick={() => run('stock_missing', { available })} className={`${btn} border border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950/30`}>
              {busy === 'stock_missing' && <Loader2 size={15} className="animate-spin" />} Falta peça
            </button>
          )}
          <button type="button" disabled={busy !== null || (os.status === 'aguardando_estoque' && !all)} onClick={() => run('stock_ok')} className={`${btn} flex-1 bg-emerald-600 text-white hover:bg-emerald-700`}>
            {busy === 'stock_ok' && <Loader2 size={15} className="animate-spin" />} Peças disponíveis: enviar ao CS
          </button>
        </div>
        {os.status === 'aguardando_estoque' && <p className="text-[11px] text-zinc-500">Marque na lista acima o que tem. Com tudo marcado, envia ao CS; faltando algo, use "Falta peça".</p>}
      </div>
    );
  } else if (os.status === 'aguardando_autorizacao' && canApproveOS) {
    const total = quoteTotal(os, quote);
    const text = authRequestText(os, quote, unit?.franchiseeName, settings.storeName);
    const subject = `Autorização de manutenção · ${os.model} ${os.plate}`;
    const asked = os.events.filter(e => e.type === 'request_auth').length;
    const sendEmail = () => {
      window.location.href = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      run('request_auth', { note: `Por e-mail para ${contact.email} · Valor total ${brl(total)}` });
    };
    const sendWhats = () => {
      window.open(`https://wa.me/${waNumber(contact.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      run('request_auth', { note: `Por WhatsApp para ${contact.phone} · Valor total ${brl(total)}` });
    };
    const pickProof = async (f: File) => {
      setReadingProof(true);
      try {
        if (f.type.startsWith('image/')) setProof({ name: f.name, url: await compressImage(f) });
        else if (f.type === 'application/pdf') {
          if (f.size > 1_000_000) { toast.error('PDF grande demais (máx. 1 MB). Envie um print do e-mail.'); return; }
          const url = await new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(f); });
          setProof({ name: f.name, url });
        } else toast.error('Envie um print (imagem) ou PDF do e-mail.');
      } catch { toast.error('Não consegui ler o arquivo.'); } finally { setReadingProof(false); }
    };
    action = (
      <div className="space-y-5">
        {/* 1. Pedir ao franqueado */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[11px] text-white">1</span>Peça a autorização ao franqueado</p>
            {asked > 0 && <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Pedido enviado {asked}×</span>}
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40">
            <table className="w-full text-sm">
              <caption className="sr-only">Valor da manutenção</caption>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {os.items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{it.quantity}× {it.description}</td>
                    <td className="w-32 px-3 py-2 text-right tabular-nums text-zinc-500" title="Preço do cadastro do estoque (não editável)">
                      {quote.prices[i] ? brl(quote.prices[i]) : <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Sem preço no estoque</span>}
                    </td>
                    <td className="w-28 px-3 py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-white">{brl(it.quantity * (quote.prices[i] || 0))}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">Mão de obra</td>
                  <td className="w-32 px-2 py-1.5">
                    <label className="sr-only" htmlFor="price-labor">Valor da mão de obra</label>
                    <input id="price-labor" type="number" min={0} step="0.01" inputMode="decimal" value={quote.labor || ''} placeholder="0,00"
                      onChange={e => setLabor(Math.max(0, Number(e.target.value) || 0))}
                      className={`${fieldClass} py-1.5 text-right tabular-nums`} />
                  </td>
                  <td className="w-28 px-3 py-2 text-right font-medium tabular-nums text-zinc-900 dark:text-white">{brl(quote.labor || 0)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/70 dark:bg-slate-950/20">
                  <td colSpan={2} className="px-3 py-2.5 text-sm font-bold text-zinc-900 dark:text-white">Valor total da manutenção</td>
                  <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums text-slate-700 dark:text-slate-300">{brl(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">Preço das peças é o do cadastro do estoque e não pode ser alterado aqui.</p>
          {total <= 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400">Informe os valores para enviar o pedido com o preço.</p>}
          <p className="text-xs text-zinc-500">{unit?.franchiseeName ? <>Franqueado: <b className="text-zinc-700 dark:text-zinc-300">{unit.franchiseeName}</b></> : 'Base sem franqueado cadastrado: preencha abaixo (ou cadastre em Configurações).'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex gap-2">
              <input type="email" aria-label="E-mail do franqueado" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} placeholder="email@franqueado.com" className={fieldClass} />
              <button type="button" disabled={!/^\S+@\S+\.\S+$/.test(contact.email) || busy !== null || total <= 0} onClick={sendEmail} className={`${btn} shrink-0 border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`}>
                <Mail size={15} /> E-mail
              </button>
            </div>
            <div className="flex gap-2">
              <input type="tel" aria-label="WhatsApp do franqueado" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} placeholder="(11) 98888-7777" className={fieldClass} />
              <button type="button" disabled={contact.phone.replace(/\D/g, '').length < 10 || busy !== null || total <= 0} onClick={sendWhats} className={`${btn} shrink-0 bg-[#25D366] text-white hover:brightness-95`}>
                <MessageCircle size={15} /> WhatsApp
              </button>
            </div>
          </div>
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer select-none font-medium hover:text-zinc-700 dark:hover:text-zinc-300">Ver a mensagem que será enviada</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">{text}</pre>
          </details>
        </div>

        {/* 2. Anexar a resposta e decidir */}
        <div className="space-y-3 border-t border-blue-200/60 pt-4 dark:border-blue-900/40">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[11px] text-white">2</span>Anexe a resposta do franqueado autorizando</p>
          {proof ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-50/60 px-3 py-2 text-sm dark:bg-emerald-950/20">
              <FileText size={16} className="shrink-0 text-emerald-600" />
              <button type="button" onClick={() => openProof(proof.url)} className="min-w-0 flex-1 truncate text-left font-medium text-zinc-800 hover:underline dark:text-zinc-100 cursor-pointer">{proof.name}</button>
              <button type="button" onClick={() => setProof(null)} aria-label="Remover anexo" className="rounded p-1 text-zinc-400 hover:text-red-600 cursor-pointer"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-sm font-medium text-zinc-500 hover:border-slate-500 hover:text-slate-600 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-slate-600/40">
              {readingProof ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />} Anexar print ou PDF do e-mail de resposta
              <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Anexar comprovante da autorização"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickProof(f); }} />
            </label>
          )}
          {noteField('Observação (obrigatória para recusar)')}
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null || !note.trim()} onClick={() => run('reject')} className={`${btn} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30`}>
              {busy === 'reject' && <Loader2 size={15} className="animate-spin" />} Recusar
            </button>
            <button type="button" disabled={busy !== null || !proof} onClick={() => run('authorize', { proof })} className={`${btn} flex-1 bg-slate-600 text-white hover:bg-slate-700`}>
              {busy === 'authorize' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={16} />} Autorizar serviço
            </button>
          </div>
          {!proof && <p className="text-center text-[11px] text-zinc-500">Para autorizar, anexe o e-mail do franqueado.</p>}
        </div>
      </div>
    );
  } else if (os.status === 'autorizada' && canManageOS) {
    action = (
      <button type="button" disabled={busy !== null} onClick={() => run('start')} className={`${btn} w-full bg-emerald-600 py-3.5 text-base text-white hover:bg-emerald-700`}>
        {busy === 'start' ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Iniciar manutenção{os.estimatedMinutes ? ` · prazo ${formatDuration(os.estimatedMinutes * 60_000)}` : ''}
      </button>
    );
  } else if (os.status === 'finalizada' && canCheckin) {
    action = (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Entregar a moto ao locatário{os.customerName ? `: ${os.customerName}` : ''}</p>
        {noteField('Observação da entrega (opcional)')}
        <button type="button" disabled={busy !== null} onClick={() => run('deliver')} className={`${btn} w-full bg-emerald-600 text-white hover:bg-emerald-700`}>
          {busy === 'deliver' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={16} />} Moto entregue
        </button>
      </div>
    );
  } else if (os.status === 'em_manutencao') {
    action = (
      <div className="space-y-3 text-center">
        <DeadlinePanel os={os} />
        {canManageOS && (
          <div className="space-y-3 text-left">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Para finalizar: fotos da moto pronta e o que foi feito</p>
            <div className="flex flex-wrap gap-2">
              {finalPhotos.map((url, i) => (
                <div key={i} className="relative h-20 w-24 overflow-hidden rounded-lg border border-emerald-500/60">
                  <img src={url} alt={`Foto final ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setFinalPhotos(finalPhotos.filter((_, j) => j !== i))} aria-label={`Remover foto ${i + 1}`} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 cursor-pointer"><X size={11} /></button>
                </div>
              ))}
              {finalPhotos.length < 6 && (
                <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-[11px] font-medium text-zinc-500 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-blue-600/40">
                  {shooting ? <Loader2 size={16} className="animate-spin" aria-label="Processando foto" /> : <><Camera size={16} aria-hidden="true" />Tirar foto</>}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Tirar foto da moto pronta"
                    onChange={async e => {
                      const f = e.target.files?.[0]; e.target.value = '';
                      if (!f) return;
                      setShooting(true);
                      try { const url = await compressImage(f); setFinalPhotos(p => [...p, url].slice(0, 6)); } catch { toast.error('Não consegui ler essa foto.'); } finally { setShooting(false); }
                    }} />
                </label>
              )}
            </div>
            {noteField('O que foi feito na moto (obrigatório)')}
            <button type="button" disabled={busy !== null || shooting || !finalPhotos.length || !note.trim()} onClick={() => run('finish', { photos: finalPhotos })} className={`${btn} w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200`}>
              {busy === 'finish' ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} />} Finalizar manutenção
            </button>
            {(!finalPhotos.length || !note.trim()) && <p className="text-center text-[11px] text-zinc-500">Falta {[!finalPhotos.length && 'ao menos 1 foto', !note.trim() && 'a observação'].filter(Boolean).join(' e ')}.</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <article aria-labelledby="moto-os-title" className="w-full space-y-4 pb-24 lg:pb-6">
      <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer">
        <ArrowLeft size={16} aria-hidden="true" /> Voltar para a lista
      </button>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/90">
        <header className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="moto-os-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{os.model}</h1>
              <span className="font-mono text-sm text-zinc-500">{os.plate}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[os.status]}`}>{motoStatusLabel(os)}</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{os.km.toLocaleString('pt-BR')} km{os.franchiseName ? ` · franquia ${os.franchiseName}` : ''}{os.customerName ? ` · locatário ${os.customerName}${os.customerPhone ? ` (${os.customerPhone})` : ''}` : ''} · recebida por {os.createdByName} em {dateTime(os.createdAt)}</p>
          </div>
          {os.startedAt && (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-semibold text-zinc-500">{os.finishedAt ? 'Tempo de manutenção' : 'Em manutenção há'}</p>
              <MaintenanceTimer startedAt={os.startedAt} finishedAt={os.finishedAt} estimatedMinutes={os.estimatedMinutes} className="text-lg font-bold text-zinc-900 dark:text-white" />
            </div>
          )}
        </header>

        {/* Etapas */}
        <ol className="flex border-b border-zinc-200 px-5 py-3 dark:border-zinc-800" aria-label="Etapas">
          {MOTO_STEPS.map((label, i) => {
            const done = i < stepIndex || os.status === 'entregue';
            const current = i === stepIndex;
            return (
              <li key={label} className="flex flex-1 items-center gap-1.5 text-[11px] font-semibold">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>{done ? <Check size={11} /> : i + 1}</span>
                <span className={`hidden sm:inline ${current ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>{label}</span>
                {i < MOTO_STEPS.length - 1 && <span className={`mx-1 h-px flex-1 ${done ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          {/* Linha do tempo */}
          <section aria-labelledby="timeline-title" className="lg:order-2 lg:border-l lg:border-zinc-200 lg:pl-6 lg:dark:border-zinc-800">
            <h2 id="timeline-title" className="mb-5 text-lg font-bold text-zinc-900 dark:text-white">Linha do tempo</h2>
            <ol className="relative space-y-6 border-l-2 border-zinc-200 pl-8 dark:border-zinc-800">
              {os.events.map((ev, i) => {
                const Icon = EVENT_ICON[ev.type];
                const meta = EVENT_LABEL[ev.type];
                const last = i === os.events.length - 1;
                // Quanto tempo a moto ficou parada entre um passo e o próximo
                const waited = i > 0 ? formatDuration(new Date(ev.at).getTime() - new Date(os.events[i - 1].at).getTime()) : null;
                return (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[3.2rem] top-0.5 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900 ${ev.type === 'reject' ? 'bg-red-500 text-white' : last ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" aria-hidden="true">{initials(ev.byName)}</span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">{ev.byName}</span>
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{meta.who}</span>
                      <span className="ml-auto text-xs tabular-nums text-zinc-500">{dateTime(ev.at)}</span>
                    </div>
                    <p className="mt-1.5 text-base font-medium text-zinc-800 dark:text-zinc-100">{meta.title}</p>
                    {waited && <p className="mt-0.5 text-xs text-zinc-500">{waited} depois do passo anterior</p>}
                    {ev.note && <p className="mt-2 whitespace-pre-line rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">{ev.note}</p>}
                  </li>
                );
              })}
              {os.status !== 'finalizada' && os.status !== 'recusada' && (
                <li className="relative">
                  <span className="absolute -left-[3.2rem] top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 bg-white ring-4 ring-white dark:border-zinc-700 dark:bg-zinc-900 dark:ring-zinc-900" />
                  <p className="pt-1.5 text-base font-medium text-zinc-400">{motoStatusLabel(os)}…</p>
                </li>
              )}
            </ol>
          </section>

          <div className="space-y-5">
            {action && <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/10">{action}</section>}
            {(os.status === 'finalizada' || os.status === 'entregue') && os.startedAt && (
              <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40"><DeadlinePanel os={os} /></section>
            )}

            {os.photos?.authProof && (
              <button type="button" onClick={() => openProof(os.photos!.authProof!.url)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-900/50 dark:bg-slate-950/20 dark:hover:bg-slate-950/40 cursor-pointer">
                <ShieldCheck size={18} className="shrink-0 text-slate-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-white">Autorização do franqueado</span>
                  <span className="block truncate text-xs text-zinc-500">{os.photos.authProof.name} · clique para abrir</span>
                </span>
              </button>
            )}
            {os.items.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">Pedido do mecânico</h3>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {os.items.map((it, i) => {
                    const p = stockOf(it.code);
                    const checking = os.status === 'aguardando_estoque' && canManageInventory;
                    return (
                      <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                        {checking ? (
                          <input type="checkbox" aria-label={`Tem ${it.description} em estoque`} checked={available[i] ?? false} onChange={e => setAvailable(available.map((v, j) => j === i ? e.target.checked : v))} className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-300 text-emerald-600" />
                        ) : it.available !== undefined && (
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${it.available ? 'bg-emerald-500' : 'bg-orange-500'}`} title={it.available ? 'Disponível' : 'Faltando'} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{it.quantity}× {it.description}{it.code && <span className="ml-1.5 font-mono text-[11px] text-zinc-500">{it.code}</span>}</p>
                          {it.purpose && <p className="text-xs text-zinc-500">{it.purpose}</p>}
                        </div>
                        {p && <span className={`shrink-0 text-[11px] font-semibold ${p.quantity >= it.quantity ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600'}`}>{p.quantity} em estoque</span>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              {(() => {
                const arrival = os.photos
                  ? [...PHOTO_LABELS.map(([k, label]) => [label, os.photos![k]] as const), ...(os.photos.extra ?? []).map((u, i) => [`Avaria ${i + 1}`, u] as const)]
                      .filter((x): x is readonly [string, string] => Boolean(x[1]))
                  : [];
                const final = (os.photos?.final ?? []).map((u, i) => [`Moto pronta ${i + 1}`, u] as const);
                const gallery = (title: string, set: 'arrival' | 'final', shots: (readonly [string, string])[]) => (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
                      {shots.length > 0 && <span className="text-xs text-zinc-500">{shots.length} fotos · toque para ampliar</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {shots.map(([label, url], i) => (
                        <button key={label} type="button" onClick={() => setZoom({ set, i })} aria-label={`Ampliar foto: ${label}`}
                          className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-800 cursor-zoom-in">
                          <img src={url} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><Expand size={16} aria-hidden="true" /></span>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-semibold text-white">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
                const zoomed = zoom ? (zoom.set === 'final' ? final : arrival) : [];
                return (
                  <div className="space-y-5">
                    {!os.photos
                      ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-zinc-400" aria-label="Carregando fotos" /></div>
                      : <>
                          {final.length > 0 && gallery('Fotos da moto pronta', 'final', final)}
                          {gallery('Fotos da chegada', 'arrival', arrival)}
                        </>}
                    {zoom && zoomed[zoom.i] && <PhotoViewer photos={zoomed} index={zoom.i} onIndex={i => setZoom(i === null ? null : { set: zoom.set, i })} />}
                  </div>
                );
              })()}
            </section>
          </div>

        </div>
      </div>
    </article>
  );
};
