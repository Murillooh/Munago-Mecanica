import { Router } from 'express';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { categories, products } from '../db/schema';
import { requirePermission } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).nullish(),
  imageUrl: z.string().max(500_000).nullish(),
  aiSuggestion: z.string().max(5000).nullish(),
});

const isUniqueViolation = (e: unknown) =>
  (e as { code?: string; cause?: { code?: string } })?.code === '23505' ||
  (e as { cause?: { code?: string } })?.cause?.code === '23505';

const duplicate = () => new ApiError(409, 'CATEGORY_EXISTS', 'Já existe uma categoria com este nome.');

export function createCategoriesRouter({ db, bus }: ApiDeps) {
  const r = Router();

  r.get('/categories', requirePermission(), asyncHandler(async (_req, res) => {
    res.json(await db.select().from(categories).orderBy(asc(categories.name)));
  }));

  r.post('/categories', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const data = categoryInput.parse(req.body);
    try {
      const [row] = await db.insert(categories).values({ id: newId(), ...data }).returning();
      bus.emitChange('categories');
      res.status(201).json(row);
    } catch (e) {
      throw isUniqueViolation(e) ? duplicate() : e;
    }
  }));

  // Produtos guardam o nome da categoria: renomear propaga na mesma transação.
  r.patch('/categories/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const updates = categoryInput.partial().parse(req.body);
    try {
      const row = await db.transaction(async (tx) => {
        const [old] = await tx.select().from(categories).where(eq(categories.id, req.params.id));
        if (!old) throw new ApiError(404, 'NOT_FOUND', 'Categoria não encontrada.');
        const [updated] = await tx.update(categories).set(updates).where(eq(categories.id, old.id)).returning();
        if (updates.name && updates.name !== old.name) {
          await tx.update(products).set({ category: updates.name }).where(eq(products.category, old.name));
        }
        return updated;
      });
      bus.emitChange('categories', 'products');
      res.json(row);
    } catch (e) {
      throw isUniqueViolation(e) ? duplicate() : e;
    }
  }));

  r.delete('/categories/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const [cat] = await db.select().from(categories).where(eq(categories.id, req.params.id));
    if (cat) {
      const [inUse] = await db.select({ id: products.id }).from(products).where(eq(products.category, cat.name)).limit(1);
      if (inUse) {
        throw new ApiError(409, 'CATEGORY_IN_USE', 'Não é possível excluir uma categoria que possui produtos vinculados.');
      }
      await db.delete(categories).where(eq(categories.id, cat.id));
      bus.emitChange('categories');
    }
    res.status(204).end();
  }));

  return r;
}
