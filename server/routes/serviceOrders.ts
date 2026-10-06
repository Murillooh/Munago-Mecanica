import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { serviceOrders } from '../db/schema';
import { requirePermission } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { applyMovement } from '../services/stock';
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
});

// Zod 4 aplica .default() mesmo dentro de .partial(): edição usa os campos sem default.
const osInput = osFields.extend({
  generalLaborCost: money.default(0),
  totalLaborCost: money.default(0),
  totalPartsCost: money.default(0),
  totalAmount: money.default(0),
  status: osFields.shape.status.default('draft'),
});

// Itens não mudam após criar: alterar exigiria estornar estoque.
const osPatch = osFields.omit({ items: true }).partial().strict();

export function createServiceOrdersRouter({ db, bus }: ApiDeps) {
  const r = Router();

  r.get('/service-orders', requirePermission(), asyncHandler(async (_req, res) => {
    res.json(await db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt)));
  }));

  r.post('/service-orders', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const data = osInput.parse(req.body);
    const user = req.user!;
    const { allowNegativeStock } = await getSettings(db);
    const id = newId();
    const reason = `Ordem de Serviço #${id.slice(-6).toUpperCase()}`;

    const { row, notified } = await db.transaction(async (tx) => {
      const [row] = await tx.insert(serviceOrders).values({ id, ...data, createdBy: user.id }).returning();
      let notified = false;
      for (const item of data.items) {
        const m = await applyMovement(tx, {
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
    const [row] = await db.update(serviceOrders).set({ ...parsed.data, updatedAt: sql`now()` })
      .where(eq(serviceOrders.id, req.params.id)).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
    bus.emitChange('serviceOrders');
    res.json(row);
  }));

  // Igual ao comportamento atual: excluir não devolve estoque.
  r.delete('/service-orders/:id', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    await db.delete(serviceOrders).where(eq(serviceOrders.id, req.params.id));
    bus.emitChange('serviceOrders');
    res.status(204).end();
  }));

  return r;
}
