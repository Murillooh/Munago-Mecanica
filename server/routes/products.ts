import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { products } from '../db/schema';
import { requirePermission, ws } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { getSettings } from './settings';
import { newId, type ApiDeps } from './deps';

const optText = (max: number) => z.string().max(max).nullish();
const optMoney = z.number().nonnegative().nullish();

const productFields = z.object({
  sku: optText(100),
  name: z.string().trim().min(1).max(200),
  description: optText(2000),
  category: optText(100),
  price: optMoney,
  laborCost: optMoney,
  quantity: z.number().int(),
  minQuantity: z.number().int().nonnegative(),
  status: z.enum(['ativo', 'inativo']),
  imageUrl: optText(500_000), // pode ser data URL
  observation: optText(2000),
  expirationDate: optText(30),
  batch: optText(100),
  supplier: optText(200),
});

// Zod 4 aplica .default() mesmo dentro de .partial(): edição usa os campos sem default.
export const productInput = productFields.extend({ status: productFields.shape.status.default('ativo') });
const productPatch = productFields.partial();

export function createProductsRouter({ db, bus }: ApiDeps) {
  const r = Router();

  async function assertQuantityAllowed(workspaceId: string, qty: number | undefined) {
    if (qty === undefined || qty >= 0) return;
    if (!(await getSettings(db, workspaceId)).allowNegativeStock) {
      throw new ApiError(400, 'NEGATIVE_STOCK', 'Estoque não pode ser negativo de acordo com as configurações do sistema.');
    }
  }

  const mine = (workspaceId: string, id: string) => and(eq(products.workspaceId, workspaceId), eq(products.id, id));

  r.get('/products', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select().from(products).where(eq(products.workspaceId, ws(req))).orderBy(asc(products.name)));
  }));

  r.post('/products', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const data = productInput.parse(req.body);
    await assertQuantityAllowed(ws(req), data.quantity);
    const [row] = await db.insert(products).values({ id: newId(), workspaceId: ws(req), ...data }).returning();
    bus.emitChange('products');
    res.status(201).json(row);
  }));

  r.post('/products/bulk', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const list = z.array(productInput).min(1).max(1000).parse(req.body);
    for (const p of list) await assertQuantityAllowed(ws(req), p.quantity);
    const rows = await db.insert(products).values(list.map((p) => ({ id: newId(), workspaceId: ws(req), ...p }))).returning();
    bus.emitChange('products');
    res.status(201).json(rows);
  }));

  r.patch('/products/bulk', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const { ids, updates } = z.object({ ids: z.array(z.string()).min(1).max(1000), updates: productPatch }).parse(req.body);
    await assertQuantityAllowed(ws(req), updates.quantity);
    await db.update(products).set({ ...updates, updatedAt: sql`now()` })
      .where(and(eq(products.workspaceId, ws(req)), inArray(products.id, ids)));
    bus.emitChange('products');
    res.status(204).end();
  }));

  r.patch('/products/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const updates = productPatch.parse(req.body);
    await assertQuantityAllowed(ws(req), updates.quantity);
    const [row] = await db.update(products).set({ ...updates, updatedAt: sql`now()` })
      .where(mine(ws(req), req.params.id)).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Produto não encontrado.');
    bus.emitChange('products');
    res.json(row);
  }));

  r.delete('/products/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    await db.delete(products).where(mine(ws(req), req.params.id));
    bus.emitChange('products');
    res.status(204).end();
  }));

  return r;
}
