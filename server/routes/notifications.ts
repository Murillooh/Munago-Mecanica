import { Router, type RequestHandler } from 'express';
import { desc, eq } from 'drizzle-orm';
import { notifications } from '../db/schema';
import { effectivePermissions, requirePermission } from '../auth/middleware';
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

  r.get('/notifications', ...guard, asyncHandler(async (_req, res) => {
    res.json(await db.select().from(notifications).orderBy(desc(notifications.timestamp)).limit(500));
  }));

  r.patch('/notifications/:id/read', ...guard, asyncHandler(async (req, res) => {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, req.params.id));
    bus.emitChange('notifications');
    res.status(204).end();
  }));

  r.delete('/notifications/:id', ...guard, asyncHandler(async (req, res) => {
    await db.delete(notifications).where(eq(notifications.id, req.params.id));
    bus.emitChange('notifications');
    res.status(204).end();
  }));

  return r;
}
