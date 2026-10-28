import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDownLeft, ArrowUpRight, Minus, Plus, X, AlertTriangle, Loader2 } from 'lucide-react';

type MovementType = 'in' | 'out';

interface MovementProduct {
  name: string;
  sku?: string;
  quantity: number;
  minQuantity?: number;
}

interface Props {
  open: boolean;
  type: MovementType;
  product: MovementProduct | null;
  allowNegativeStock?: boolean;
  onClose: () => void;
  /** Registra a movimentação; rejeita com Error cuja mensagem vai para a tela. */
  onConfirm: (quantity: number, reason: string) => Promise<void>;
}

const REASONS: Record<MovementType, string[]> = {
  out: ['Uso em ordem de serviço', 'Perda ou avaria', 'Ajuste de inventário', 'Devolução ao fornecedor'],
  in: ['Compra', 'Devolução de ordem de serviço', 'Ajuste de inventário', 'Transferência'],
};

const QUICK = [1, 5, 10];

const COPY = {
  in: { title: 'Entrada de estoque', confirm: 'Registrar entrada', sign: '+', icon: ArrowDownLeft, tone: 'emerald' },
  out: { title: 'Saída de estoque', confirm: 'Registrar saída', sign: '−', icon: ArrowUpRight, tone: 'red' },
} as const;

export const MovementModal: React.FC<Props> = ({ open, type, product, allowNegativeStock, onClose, onConfirm }) => {
  const uid = useId();
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQty(1);
    setReason('');
    setError(null);
    setSaving(false);
  }, [open, type, product?.name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!product) return null;

  const c = COPY[type];
  const current = product.quantity || 0;
  const min = product.minQuantity || 0;
  const validQty = Number.isInteger(qty) && qty >= 1;
  const next = type === 'in' ? current + (validQty ? qty : 0) : current - (validQty ? qty : 0);
  const negative = type === 'out' && next < 0;
  const blocked = negative && !allowNegativeStock;
  const belowMin = !negative && min > 0 && next < min;
  const canSubmit = validQty && !blocked && reason.trim().length > 0 && !saving;

  const toneText = c.tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const toneBg = c.tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600' : 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600';
  const toneBadge = c.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(qty, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a movimentação.');
      setSaving(false);
    }
  };

  const stepBtn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 cursor-pointer';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-title`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-md overflow-hidden border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneBadge}`} aria-hidden="true">
                  <c.icon size={16} />
                </span>
                <div className="min-w-0">
                  <h3 id={`${uid}-title`} className="text-base font-semibold text-zinc-900 dark:text-white">{c.title}</h3>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-300" title={product.name}>{product.name}</p>
                  <p className="font-mono text-[11px] text-zinc-400">{product.sku || 'sem SKU'}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="-mr-1.5 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submit} className="space-y-5 px-5 py-5">
              {/* Quantidade */}
              <div>
                <label htmlFor={`${uid}-qty`} className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quantidade</label>
                <div className="flex items-center gap-2">
                  <button type="button" className={stepBtn} onClick={() => setQty(q => Math.max(1, (q || 1) - 1))} disabled={qty <= 1} aria-label="Diminuir quantidade">
                    <Minus size={16} />
                  </button>
                  <div className="relative flex-1">
                    <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg font-bold ${toneText}`} aria-hidden="true">{c.sign}</span>
                    <input
                      id={`${uid}-qty`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={Number.isNaN(qty) ? '' : qty}
                      onChange={e => setQty(e.target.value === '' ? NaN : Math.floor(Number(e.target.value)))}
                      autoFocus
                      className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-10 text-center font-mono text-xl font-bold tabular-nums text-zinc-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/15 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:focus:bg-zinc-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">un</span>
                  </div>
                  <button type="button" className={stepBtn} onClick={() => setQty(q => (q || 0) + 1)} aria-label="Aumentar quantidade">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {QUICK.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQty(n)}
                      className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer ${qty === n ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                    >
                      {n}
                    </button>
                  ))}
                  {type === 'out' && current > 0 && (
                    <button
                      type="button"
                      onClick={() => setQty(current)}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Tudo ({current})
                    </button>
                  )}
                </div>
              </div>

              {/* Prévia do saldo */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3.5 py-2.5 text-sm dark:bg-zinc-800/50" aria-live="polite">
                <span className="text-zinc-500 dark:text-zinc-400">Saldo</span>
                <span className="font-mono tabular-nums">
                  <span className="text-zinc-500">{current}</span>
                  <span className="mx-2 text-zinc-400" aria-hidden="true">→</span>
                  <span className={`font-bold ${negative ? 'text-red-600 dark:text-red-400' : belowMin ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>{validQty ? next : '—'}</span>
                  <span className="ml-1 text-xs text-zinc-400">un</span>
                </span>
              </div>
              {blocked && (
                <p className="-mt-3 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"><AlertTriangle size={13} aria-hidden="true" /> Saldo insuficiente: só há {current} un em estoque.</p>
              )}
              {!blocked && negative && (
                <p className="-mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle size={13} aria-hidden="true" /> O saldo vai ficar negativo (permitido nas configurações).</p>
              )}
              {belowMin && (
                <p className="-mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle size={13} aria-hidden="true" /> Fica abaixo do estoque mínimo ({min} un) e gera alerta de reposição.</p>
              )}

              {/* Motivo */}
              <div>
                <label htmlFor={`${uid}-reason`} className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Motivo</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {REASONS[type].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(prev => (prev.trim() && !REASONS[type].includes(prev.trim()) ? `${r} · ${prev.trim()}` : r))}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer ${reason.startsWith(r) ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  id={`${uid}-reason`}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  maxLength={500}
                  rows={2}
                  required
                  placeholder={type === 'out' ? 'Ex.: OS #A1B2C3, moto FRT1A01' : 'Ex.: NF 1829, fornecedor Moto Peças'}
                  className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/15 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>
              )}

              <div className="flex gap-2.5">
                <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900 cursor-pointer ${toneBg}`}
                >
                  {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {saving ? 'Registrando…' : `${c.confirm}${validQty ? ` (${c.sign}${qty})` : ''}`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
