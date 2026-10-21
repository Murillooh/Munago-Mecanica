import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { serviceOrders, services, type ServiceOrderService } from '../db/schema';
import type { DB } from '../db/client';
import type { ChangeBus } from '../realtime/events';
import { PAID_STATUSES } from '../services/asaas';
import { requirePermission, ws } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { applyMovement } from '../services/stock';
import { NO_SPLIT, freezeSplit, serviceRepasse } from '../services/revenueSplit';
import { getSettings } from './settings';
import { newId, type ApiDeps } from './deps';

const money = z.number().nonnegative();
const optText = (max: number) => z.string().max(max).nullish();

const itemInput = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  price: money,
  laborCost: money.default(0),
  total: money,
  observation: z.string().max(1000).optional(),
});

const osFields = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerPhone: optText(50),
  vehicleModel: optText(100),
  vehiclePlate: optText(20),
  items: z.array(itemInput).max(200),
  generalLaborCost: money,
  totalLaborCost: money,
  totalPartsCost: money,
  totalAmount: money,
  status: z.enum(['draft', 'in_progress', 'completed', 'paid']),
  scheduledDate: z.string().min(1).max(40),
  completionDate: optText(40),
  observations: optText(2000),
  // Só o id e a quantidade: preço e repasse vêm do catálogo da oficina (o navegador não define).
  serviceItems: z.array(z.object({ serviceId: z.string().min(1), quantity: z.number().int().positive().max(1000) })).max(100),
});

// Zod 4 aplica .default() mesmo dentro de .partial(): edição usa os campos sem default.
const osInput = osFields.extend({
  generalLaborCost: money.default(0),
  totalLaborCost: money.default(0),
  totalPartsCost: money.default(0),
  totalAmount: money.default(0),
  status: osFields.shape.status.default('draft'),
  serviceItems: osFields.shape.serviceItems.default([]),
});

// Itens não mudam após criar: alterar exigiria estornar estoque.
const osPatch = osFields.omit({ items: true }).partial().strict();

const chargeInput = z.object({
  cpfCnpj: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length === 11 || v.length === 14, 'Informe o CPF ou CNPJ do cliente.'),
});

/** Copia do catálogo da oficina preço e repasse de cada serviço pedido; serviço de outra oficina → 404. */
async function resolveServices(db: DB, workspaceId: string, wanted: { serviceId: string; quantity: number }[]) {
  if (wanted.length === 0) return { serviceItems: [] as ServiceOrderService[], repasseAmount: 0 };
  const catalog = await db.select().from(services)
    .where(and(eq(services.workspaceId, workspaceId), inArray(services.id, wanted.map((w) => w.serviceId))));
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const serviceItems = wanted.map(({ serviceId, quantity }) => {
    const s = byId.get(serviceId);
    if (!s) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Serviço não encontrado.');
    return {
      serviceId, name: s.name, price: s.price, quantity,
      repasseType: s.repasseType, repasseValue: s.repasseValue,
      repasseAmount: serviceRepasse(s.price, quantity, s.repasseType, s.repasseValue),
    };
  });
  const repasseAmount = Math.round(serviceItems.reduce((a, i) => a + i.repasseAmount * 100, 0)) / 100;
  return { serviceItems, repasseAmount };
}

const checkTotal = (totalAmount: number, repasseAmount: number) => {
  if (totalAmount < repasseAmount) throw new ApiError(400, 'INVALID_TOTAL', 'O total da OS não pode ser menor que o repasse dos serviços.');
};

/** Marca como paga a OS da cobrança, congelando o repasse dos serviços. Idempotente. */
export async function markServiceOrderPaid(db: DB, bus: ChangeBus, asaasPaymentId: string) {
  const [os] = await db.select().from(serviceOrders).where(eq(serviceOrders.asaasPaymentId, asaasPaymentId));
  if (!os || os.status === 'paid') return;
  await db.update(serviceOrders)
    .set({ status: 'paid', ...freezeSplit(os.totalAmount, os.repasseAmount), paidAt: new Date(), updatedAt: sql`now()` })
    .where(eq(serviceOrders.id, os.id));
  bus.emitChange('serviceOrders');
}

/** Webhook público do Asaas: autenticado pelo token configurado no painel (header asaas-access-token). */
export function createAsaasWebhookRouter({ db, bus }: ApiDeps, token?: string) {
  const r = Router();
  r.post('/asaas/webhook', asyncHandler(async (req, res) => {
    const sent = req.get('asaas-access-token') ?? '';
    const ok = !!token && sent.length === token.length && timingSafeEqual(Buffer.from(sent), Buffer.from(token));
    if (!ok) return res.status(401).json({ error: 'Token inválido.', code: 'INVALID_TOKEN' });
    const { event, payment } = req.body ?? {};
    if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) && typeof payment?.id === 'string') {
      await markServiceOrderPaid(db, bus, payment.id);
    }
    // 200 sempre (inclusive para eventos ignorados): senão o Asaas reenvia e pausa a fila.
    res.json({ received: true });
  }));
  return r;
}

export function createServiceOrdersRouter({ db, bus, payments }: ApiDeps) {
  const r = Router();

  const mine = (workspaceId: string, id: string) => and(eq(serviceOrders.workspaceId, workspaceId), eq(serviceOrders.id, id));

  r.get('/service-orders', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select().from(serviceOrders).where(eq(serviceOrders.workspaceId, ws(req))).orderBy(desc(serviceOrders.createdAt)));
  }));

  r.post('/service-orders', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const { serviceItems: wanted, ...data } = osInput.parse(req.body);
    const user = req.user!;
    const workspaceId = ws(req);
    const { allowNegativeStock } = await getSettings(db, workspaceId);
    const { serviceItems, repasseAmount } = await resolveServices(db, workspaceId, wanted);
    checkTotal(data.totalAmount, repasseAmount);
    const id = newId();
    const reason = `Ordem de Serviço #${id.slice(-6).toUpperCase()}`;
    const split = data.status === 'paid' ? { ...freezeSplit(data.totalAmount, repasseAmount), paidAt: new Date() } : NO_SPLIT;

    const { row, notified } = await db.transaction(async (tx) => {
      const [row] = await tx.insert(serviceOrders)
        .values({ id, workspaceId, ...data, serviceItems, repasseAmount, ...split, createdBy: user.id }).returning();
      let notified = false;
      for (const item of data.items) {
        const m = await applyMovement(tx, {
          workspaceId,
          productId: item.productId, type: 'out', quantity: item.quantity, reason, userId: user.id, userName: user.name,
        }, allowNegativeStock);
        notified ||= m.notified;
      }
      return { row, notified };
    });

    bus.emitChange('serviceOrders', 'products', 'transactions', ...(notified ? ['notifications' as const] : []));
    res.status(201).json(row);
  }));

  r.patch('/service-orders/:id', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const parsed = osPatch.safeParse(req.body);
    if (!parsed.success) {
      if ('items' in (req.body ?? {})) {
        throw new ApiError(400, 'ITEMS_IMMUTABLE', 'Os itens da OS não podem ser alterados após a criação.');
      }
      throw parsed.error;
    }
    const { serviceItems: wanted, ...data } = parsed.data;
    const [current] = await db.select().from(serviceOrders).where(mine(ws(req), req.params.id));
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
    // A cobrança no Asaas foi emitida com o valor e o split antigos.
    const charged = !!current.asaasPaymentId && current.status !== 'paid';
    if (charged && ((data.totalAmount !== undefined && data.totalAmount !== current.totalAmount) || wanted)) {
      throw new ApiError(409, 'CHARGE_EXISTS', 'Esta OS já tem cobrança emitida; valor e serviços não podem mudar.');
    }
    if (wanted && current.status === 'paid') {
      throw new ApiError(409, 'ALREADY_PAID', 'Os serviços de uma OS paga não podem mudar.');
    }

    const resolved = wanted ? await resolveServices(db, ws(req), wanted) : null;
    const repasseAmount = resolved?.repasseAmount ?? current.repasseAmount;
    const totalAmount = data.totalAmount ?? current.totalAmount;
    checkTotal(totalAmount, repasseAmount);

    // Repasse: congelado ao virar 'paid' (mantido enquanto continuar paga); limpo se sair de 'paid'.
    const status = data.status ?? current.status;
    let split: Partial<typeof serviceOrders.$inferInsert> = NO_SPLIT;
    if (status === 'paid') {
      split = current.status === 'paid' ? {} : { ...freezeSplit(totalAmount, repasseAmount), paidAt: new Date() };
    }

    const [row] = await db.update(serviceOrders).set({ ...data, ...(resolved ?? {}), ...split, updatedAt: sql`now()` })
      .where(mine(ws(req), req.params.id)).returning();
    bus.emitChange('serviceOrders');
    res.json(row);
  }));

  // ---- Cobrança no Asaas (split: parte da oficina vai para a carteira dela, o resto fica na empresa) ----

  const gateway = () => {
    if (!payments) throw new ApiError(503, 'PAYMENTS_DISABLED', 'Pagamentos não configurados (Asaas).');
    return payments;
  };

  const chargeView = async (os: typeof serviceOrders.$inferSelect, status: string) => ({
    status,
    paymentUrl: os.paymentUrl,
    pix: PAID_STATUSES.has(status) ? null : await gateway().getPixQrCode(os.asaasPaymentId!),
  });

  r.post('/service-orders/:id/charge', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const { cpfCnpj } = chargeInput.parse(req.body);
    const [os] = await db.select().from(serviceOrders).where(mine(ws(req), req.params.id));
    if (!os) throw new ApiError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
    if (os.status === 'paid') throw new ApiError(409, 'ALREADY_PAID', 'Esta OS já está paga.');
    if (os.asaasPaymentId) return res.status(201).json(await chargeView(os, (await gateway().getCharge(os.asaasPaymentId)).status));
    if (!(os.totalAmount > 0)) throw new ApiError(400, 'INVALID_AMOUNT', 'A OS precisa ter valor para ser cobrada.');

    const settings = await getSettings(db, ws(req));
    // Parte da oficina em % do total (o Asaas aplica sobre o líquido: a taxa fica dividida na mesma proporção).
    const workshopPercent = 100 - freezeSplit(os.totalAmount, os.repasseAmount).companySharePercent;
    if (workshopPercent > 0 && !settings.asaasWalletId) {
      throw new ApiError(400, 'WALLET_MISSING', 'Cadastre a carteira Asaas da mecânica em Configurações antes de cobrar.');
    }
    const charge = await gateway().createCharge({
      customerName: os.customerName,
      cpfCnpj,
      phone: os.customerPhone,
      value: os.totalAmount,
      description: `${settings.storeName} · OS #${os.id.slice(-6).toUpperCase()}`,
      externalReference: os.id,
      split: workshopPercent > 0 ? { walletId: settings.asaasWalletId!, percent: workshopPercent } : undefined,
    });
    const [row] = await db.update(serviceOrders).set({ asaasPaymentId: charge.id, paymentUrl: charge.invoiceUrl, updatedAt: sql`now()` })
      .where(mine(ws(req), os.id)).returning();
    bus.emitChange('serviceOrders');
    res.status(201).json(await chargeView(row, 'PENDING'));
  }));

  /** Consulta o Asaas; se já recebeu, marca a OS como paga (cobre webhook atrasado ou ambiente local). */
  r.get('/service-orders/:id/charge', requirePermission(), asyncHandler(async (req, res) => {
    const [os] = await db.select().from(serviceOrders).where(mine(ws(req), req.params.id));
    if (!os?.asaasPaymentId) throw new ApiError(404, 'NOT_FOUND', 'Esta OS não tem cobrança.');
    const { status } = await gateway().getCharge(os.asaasPaymentId);
    if (PAID_STATUSES.has(status)) await markServiceOrderPaid(db, bus, os.asaasPaymentId);
    res.json(await chargeView(os, status));
  }));

  // Igual ao comportamento atual: excluir não devolve estoque.
  r.delete('/service-orders/:id', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    await db.delete(serviceOrders).where(mine(ws(req), req.params.id));
    bus.emitChange('serviceOrders');
    res.status(204).end();
  }));

  return r;
}
