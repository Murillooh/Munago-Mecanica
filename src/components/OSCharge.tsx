import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, MessageCircle, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../lib/api';

interface Charge {
  status: string;
  paymentUrl: string | null;
  pix: { payload: string; encodedImage: string } | null;
}

const PAID = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando pagamento',
  OVERDUE: 'Vencida',
  RECEIVED: 'Recebida',
  CONFIRMED: 'Confirmada',
  RECEIVED_IN_CASH: 'Recebida',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Cobrança da OS no Asaas: gera Pix/boleto/cartão com split e acompanha o pagamento.
 * Enquanto aberta, confere o status a cada 5 s; ao receber, chama `onPaid`.
 */
export const OSCharge: React.FC<{
  osId: string;
  hasCharge: boolean;
  amount: number;
  customerName: string;
  whatsappHref: string | null;
  onPaid: () => void;
}> = ({ osId, hasCharge, amount, customerName, whatsappHref, onPaid }) => {
  const [charge, setCharge] = useState<Charge | null>(null);
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = useCallback((c: Charge) => {
    setCharge(c);
    if (PAID.has(c.status)) {
      toast.success(`Pagamento de ${customerName} recebido.`);
      onPaid();
    }
  }, [customerName, onPaid]);

  const check = useCallback(async (manual = false) => {
    try {
      apply(await apiGet<Charge>(`/service-orders/${osId}/charge`));
    } catch (err) {
      if (manual) toast.error(err instanceof Error ? err.message : 'Não foi possível consultar a cobrança.');
    }
  }, [osId, apply]);

  useEffect(() => { if (hasCharge) check(); }, [hasCharge, check]);

  const pending = !!charge && !PAID.has(charge.status);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => check(), 5000);
    return () => clearInterval(t);
  }, [pending, check]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      apply(await apiPost<Charge>(`/service-orders/${osId}/charge`, { cpfCnpj: doc }));
      toast.success('Cobrança gerada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a cobrança.');
    } finally {
      setBusy(false);
    }
  };

  const copyPix = async () => {
    if (!charge?.pix) return;
    try {
      await navigator.clipboard.writeText(charge.pix.payload);
      toast.success('Código Pix copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  };

  const shareHref = whatsappHref && charge?.paymentUrl
    ? `${whatsappHref}?text=${encodeURIComponent(`Olá, ${customerName}! Segue o link para pagamento do serviço (${brl.format(amount)}): ${charge.paymentUrl}`)}`
    : null;

  return (
    <section aria-labelledby="os-charge-heading" className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
      <div className="flex flex-wrap items-center gap-2">
        <QrCode size={15} className="text-blue-600" aria-hidden="true" />
        <h3 id="os-charge-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cobrança</h3>
        {charge && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PAID.has(charge.status) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
            {STATUS_LABEL[charge.status] ?? charge.status}
          </span>
        )}
      </div>

      {!charge && !hasCharge && (
        <form onSubmit={create} className="mt-2 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="os-charge-doc" className="block text-xs text-zinc-600 dark:text-zinc-400">CPF ou CNPJ do cliente</label>
            <input
              id="os-charge-doc"
              value={doc}
              onChange={e => setDoc(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={18}
              required
              className="w-48 rounded-md border border-zinc-200 bg-white px-2 py-1.5 font-mono text-sm text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <QrCode size={14} aria-hidden="true" />}
            Gerar cobrança de {brl.format(amount)}
          </button>
          <p className="w-full text-[11px] text-zinc-500 dark:text-zinc-400">O cliente paga por Pix, boleto ou cartão. A divisão entre empresa e oficina é feita na hora pelo Asaas.</p>
        </form>
      )}

      {!charge && hasCharge && (
        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Consultando cobrança…</p>
      )}

      {pending && (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          {charge.pix && (
            <img
              src={`data:image/png;base64,${charge.pix.encodedImage}`}
              alt={`QR Code Pix para pagar ${brl.format(amount)}`}
              className="h-40 w-40 shrink-0 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
              Assim que o cliente pagar, a OS muda para <strong>Pago</strong> sozinha.
            </p>
            <div className="flex flex-wrap gap-2">
              {charge.pix && (
                <button type="button" onClick={copyPix} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer">
                  <Copy size={13} aria-hidden="true" /> Copiar Pix
                </button>
              )}
              {charge.paymentUrl && (
                <a href={charge.paymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  <ExternalLink size={13} aria-hidden="true" /> Abrir fatura
                </a>
              )}
              {shareHref && (
                <a href={shareHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <MessageCircle size={13} aria-hidden="true" /> Enviar no WhatsApp
                </a>
              )}
              <button type="button" onClick={() => check(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
                <RefreshCw size={13} aria-hidden="true" /> Verificar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {charge && PAID.has(charge.status) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check size={14} aria-hidden="true" /> Pagamento recebido e já dividido entre a oficina e a empresa.
        </p>
      )}
    </section>
  );
};
