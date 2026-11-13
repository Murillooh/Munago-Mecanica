import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { units } from '../db/schema';
import { requirePermission, ws } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

const unitInput = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(['base', 'cd']),
  franchiseeName: z.string().trim().max(100).nullable().optional(),
  franchiseeEmail: z.string().trim().toLowerCase().email('E-mail do franqueado inválido.').max(200).nullable().optional().or(z.literal('').transform(() => null)),
  franchiseePhone: z.string().trim().max(30).nullable().optional(),
});

/** Unidades da oficina (Bases e CD). Todos leem; quem gerencia a equipe cadastra. */
export function createUnitsRouter({ db, bus }: ApiDeps) {
  const r = Router();
  const mine = (workspaceId: string, id: string) => and(eq(units.workspaceId, workspaceId), eq(units.id, id));
  const duplicate = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code === '23505'
    || (e as { cause?: { code?: string } }).cause?.code === '23505';

  r.get('/units', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select().from(units).where(eq(units.workspaceId, ws(req))).orderBy(asc(units.kind), asc(units.name)));
  }));

  r.post('/units', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const data = unitInput.parse(req.body);
    try {
      const [row] = await db.insert(units).values({ id: newId(), workspaceId: ws(req), ...data }).returning();
      bus.emitChange(ws(req), 'units');
      res.status(201).json(row);
    } catch (e) {
      if (duplicate(e)) throw new ApiError(409, 'UNIT_EXISTS', 'Já existe uma unidade com esse nome.');
      throw e;
    }
  }));

  r.patch('/units/:id', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const patch = unitInput.partial().strict().parse(req.body);
    const [row] = await db.update(units).set(patch).where(mine(ws(req), req.params.id)).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Unidade não encontrada.');
    bus.emitChange(ws(req), 'units');
    res.json(row);
  }));

  // Pessoas e check-lists da unidade ficam sem unidade (FK set null); nada é apagado junto.
  r.delete('/units/:id', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    await db.delete(units).where(mine(ws(req), req.params.id));
    bus.emitChange(ws(req), 'units', 'users');
    res.status(204).end();
  }));

  return r;
}
