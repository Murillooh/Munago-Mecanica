import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { transactions } from '../db/schema';
import { requirePermission, ws } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { applyMovement } from '../services/stock';
import { getSettings } from './settings';
import type { ApiDeps } from './deps';

const movementInput = z.object({
  productId: z.string().min(1),
  type: z.enum(['in', 'out']),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).nullish(),
});

export function createTransactionsRouter({ db, bus }: ApiDeps) {
  const r = Router();

  r.get('/transactions', requirePermission(), asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(5000).default(1000).parse(req.query.limit);
    res.json(await db.select().from(transactions).where(eq(transactions.workspaceId, ws(req)))
      .orderBy(desc(transactions.timestamp)).limit(limit));
  }));

  // Imutável: sem PATCH/DELETE. Usuário vem do token, nunca do corpo.
  r.post('/transactions', requirePermission('canPerformTransactions'), asyncHandler(async (req, res) => {
    const m = movementInput.parse(req.body);
    const { allowNegativeStock } = await getSettings(db, ws(req));
    const result = await db.transaction((tx) =>
      applyMovement(tx, { ...m, workspaceId: ws(req), userId: req.user!.id, userName: req.user!.name }, allowNegativeStock));
    bus.emitChange('transactions', 'products', ...(result.notified ? ['notifications' as const] : []));
    res.status(201).json({ newQty: result.newQty, lowStock: result.lowStock });
  }));

  return r;
}
