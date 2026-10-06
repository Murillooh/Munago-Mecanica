import { Router } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { categories, products } from '../db/schema';
import { requireAdmin } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { productInput } from './products';
import type { ApiDeps } from './deps';

const restoreInput = z.object({
  products: z.array(productInput.extend({ id: z.string().min(1) })).max(10_000),
  categories: z.array(z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).nullish(),
    imageUrl: z.string().max(500_000).nullish(),
    aiSuggestion: z.string().max(5000).nullish(),
  })).max(1000),
});

// "excluded" = linha que tentou entrar no INSERT ... ON CONFLICT.
const fromExcluded = (cols: string[]) =>
  Object.fromEntries(cols.map((c) => [c, sql.raw(`excluded."${c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}"`)]));

export function createBackupsRouter({ db, bus }: ApiDeps) {
  const r = Router();

  /** Restaura produtos e categorias de um backup do Drive (upsert por id, igual ao comportamento anterior). */
  r.post('/backups/restore', requireAdmin, asyncHandler(async (req, res) => {
    const data = restoreInput.parse(req.body);
    await db.transaction(async (tx) => {
      if (data.categories.length) {
        await tx.insert(categories).values(data.categories).onConflictDoUpdate({
          target: categories.id,
          set: fromExcluded(['name', 'description', 'imageUrl', 'aiSuggestion']),
        });
      }
      if (data.products.length) {
        const cols = Object.keys(productInput.shape).filter((c) => c !== 'id');
        await tx.insert(products).values(data.products).onConflictDoUpdate({
          target: products.id,
          set: { ...fromExcluded(cols), updatedAt: sql`now()` },
        });
      }
    });
    bus.emitChange('products', 'categories');
    res.json({ products: data.products.length, categories: data.categories.length });
  }));

  return r;
}
