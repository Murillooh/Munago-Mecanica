import { ApiError } from '../middleware/errorHandler';

/** Cobrança no gateway. `split`: a parte (em %) que vai para a carteira da oficina; o resto fica na conta da empresa. */
export interface ChargeInput {
  customerName: string;
  cpfCnpj: string;
  phone?: string | null;
  value: number;
  description: string;
  /** Id da OS: volta nos webhooks e consultas. */
  externalReference: string;
  split?: { walletId: string; percent: number };
}

export interface PaymentGateway {
  createCharge(input: ChargeInput): Promise<{ id: string; invoiceUrl: string }>;
  getCharge(id: string): Promise<{ status: string }>;
  getPixQrCode(id: string): Promise<{ payload: string; encodedImage: string } | null>;
}

/** Status do Asaas que significam dinheiro recebido. */
export const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

const BASE_URL = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
};

export function createAsaasGateway(apiKey: string, env: string): PaymentGateway {
  const base = env === 'production' ? BASE_URL.production : BASE_URL.sandbox;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method,
      headers: { access_token: apiKey, 'Content-Type': 'application/json', 'User-Agent': 'munago-mecanica' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Mensagem do Asaas (ex.: CPF inválido) é útil para quem está cobrando; 5xx vira erro genérico.
      const msg = (data as { errors?: { description?: string }[] }).errors?.[0]?.description;
      throw new ApiError(res.status >= 500 ? 502 : 400, 'PAYMENT_GATEWAY', msg || 'Não foi possível falar com o Asaas.');
    }
    return data as T;
  }

  return {
    async createCharge(input) {
      const customer = await call<{ id: string }>('POST', '/customers', {
        name: input.customerName, cpfCnpj: input.cpfCnpj, mobilePhone: input.phone || undefined,
        notificationDisabled: true,
      });
      // Vence amanhã; billingType UNDEFINED deixa o cliente escolher Pix, boleto ou cartão na fatura.
      const dueDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const payment = await call<{ id: string; invoiceUrl: string }>('POST', '/payments', {
        customer: customer.id, billingType: 'UNDEFINED', value: input.value, dueDate,
        description: input.description, externalReference: input.externalReference,
        // percentualValue incide sobre o valor líquido: a taxa do Asaas fica dividida na mesma proporção.
        split: input.split ? [{ walletId: input.split.walletId, percentualValue: input.split.percent }] : undefined,
      });
      return { id: payment.id, invoiceUrl: payment.invoiceUrl };
    },
    async getCharge(id) {
      const p = await call<{ status: string }>('GET', `/payments/${encodeURIComponent(id)}`);
      return { status: p.status };
    },
    async getPixQrCode(id) {
      try {
        return await call<{ payload: string; encodedImage: string }>('GET', `/payments/${encodeURIComponent(id)}/pixQrCode`);
      } catch {
        return null; // conta sem chave Pix: a fatura ainda aceita boleto/cartão
      }
    },
  };
}
