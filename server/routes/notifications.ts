import { Router, type RequestHandler } from 'express';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { notifications, type Permissions } from '../db/schema';
import { effectivePermissions, requirePermission, ws, type AuthUser } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import type { ApiDeps } from './deps';

/** Avisos que a pessoa enxerga na Base: os gerais (estoque baixo) se cuida de estoque/OS; os dirigidos, se é do setor. */
function visibleTo(u: AuthUser, workspaceId: string) {
  const p = effectivePermissions(u);
  const mine = (Object.keys(p) as (keyof Permissions)[]).filter(k => p[k]);
  return and(
    eq(notifications.workspaceId, workspaceId),
    or(
      p.canManageInventory || p.canManageOS ? isNull(notifications.target) : undefined,
      mine.length ? inArray(notifications.target, mine) : undefined,
    ),
  );
}

// Todo usuário aprovado tem avisos (o filtro acima escolhe quais).
const canSeeNotifications: RequestHandler = (_req, _res, next) => next();

export function createNotificationsRouter({ db, bus }: ApiDeps) {
  const r = Router();
  const guard = [requirePermission(), canSeeNotifications];

  // Só mexe em aviso que a pessoa enxerga.
  const mine = (req: Parameters<typeof ws>[0] & { user?: AuthUser }, id: string) => and(visibleTo(req.user!, ws(req)), eq(notifications.id, id));

  r.get('/notifications', ...guard, asyncHandler(async (req, res) => {
    res.json(await db.select().from(notifications).where(visibleTo(req.user!, ws(req)))
      .orderBy(desc(notifications.timestamp)).limit(500));
  }));

  r.patch('/notifications/:id/read', ...guard, asyncHandler(async (req, res) => {
    await db.update(notifications).set({ read: true }).where(mine(req, req.params.id));
    bus.emitChange(ws(req), 'notifications');
    res.status(204).end();
  }));

  r.delete('/notifications/:id', ...guard, asyncHandler(async (req, res) => {
    await db.delete(notifications).where(mine(req, req.params.id));
    bus.emitChange(ws(req), 'notifications');
    res.status(204).end();
  }));

  return r;
}
