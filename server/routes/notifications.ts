import { Router, type RequestHandler } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { notifications } from '../db/schema';
import { effectivePermissions, requirePermission, ws } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import type { ApiDeps } from './deps';

// Mesmo critério do firestore.rules: quem gerencia estoque ou OS.
const canSeeNotifications: RequestHandler = (req, res, next) => {
  const p = effectivePermissions(req.user!);
  if (p.canManageInventory || p.canManageOS) return next();
  res.status(403).json({ error: 'Você não tem permissão para esta ação.', code: 'FORBIDDEN' });
};

export function createNotificationsRouter({ db, bus }: ApiDeps) {
  const r = Router();
  const guard = [requirePermission(), canSeeNotifications];

  const mine = (workspaceId: string, id: string) => and(eq(notifications.workspaceId, workspaceId), eq(notifications.id, id));

  r.get('/notifications', ...guard, asyncHandler(async (req, res) => {
    res.json(await db.select().from(notifications).where(eq(notifications.workspaceId, ws(req)))
      .orderBy(desc(notifications.timestamp)).limit(500));
  }));

  r.patch('/notifications/:id/read', ...guard, asyncHandler(async (req, res) => {
    await db.update(notifications).set({ read: true }).where(mine(ws(req), req.params.id));
    bus.emitChange('notifications');
    res.status(204).end();
  }));

  r.delete('/notifications/:id', ...guard, asyncHandler(async (req, res) => {
    await db.delete(notifications).where(mine(ws(req), req.params.id));
    bus.emitChange('notifications');
    res.status(204).end();
  }));

  return r;
}
