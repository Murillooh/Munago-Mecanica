import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { services } from '../db/schema';
import { requirePermission, ws } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

const serviceFields = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().nonnegative().max(1_000_000),
  repasseType: z.enum(['fixed', 'percent']),
  repasseValue: z.number().nonnegative(),
});

/** Repasse fixo não passa do preço; percentual não passa de 100%. */
function checkRepasse(s: z.infer<typeof serviceFields>) {
  const over = s.repasseType === 'percent' ? s.repasseValue > 100 : s.repasseValue > s.price;
  if (over) {
    throw new ApiError(400, 'INVALID_REPASSE', s.repasseType === 'percent'
      ? 'O repasse não pode passar de 100%.'
      : 'O repasse não pode ser maior que o valor do serviço.');
  }
}

/** Catálogo de serviços da oficina (preço e repasse para a empresa). Quem gerencia OS gerencia o catálogo. */
export function createServicesRouter({ db, bus }: ApiDeps) {
  const r = Router();
  const mine = (workspaceId: string, id: string) => and(eq(services.workspaceId, workspaceId), eq(services.id, id));

  r.get('/services', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select().from(services).where(eq(services.workspaceId, ws(req))).orderBy(asc(services.name)));
  }));

  r.post('/services', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const data = serviceFields.parse(req.body);
    checkRepasse(data);
    const [row] = await db.insert(services).values({ id: newId(), workspaceId: ws(req), ...data }).returning();
    bus.emitChange('services');
    res.status(201).json(row);
  }));

  r.patch('/services/:id', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    const patch = serviceFields.partial().strict().parse(req.body);
    const [current] = await db.select().from(services).where(mine(ws(req), req.params.id));
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Serviço não encontrado.');
    checkRepasse({ ...current, ...patch });
    const [row] = await db.update(services).set({ ...patch, updatedAt: sql`now()` }).where(mine(ws(req), current.id)).returning();
    bus.emitChange('services');
    res.json(row);
  }));

  // OS já criadas guardam uma cópia do serviço: excluir do catálogo não as afeta.
  r.delete('/services/:id', requirePermission('canManageOS'), asyncHandler(async (req, res) => {
    await db.delete(services).where(mine(ws(req), req.params.id));
    bus.emitChange('services');
    res.status(204).end();
  }));

  return r;
}
