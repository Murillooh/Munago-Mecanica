import { Router } from 'express';
import { z } from 'zod';
import { asc, count, eq, inArray, max, ne, sql } from 'drizzle-orm';
import { UNASSIGNED_WORKSPACE, aiSearches, products, serviceOrders, settings, transactions, users, workspaces } from '../db/schema';
import { requireSuperAdmin } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { mergeSettings } from './settings';
import type { ApiDeps } from './deps';

const renameInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const deleteInput = z.object({ confirmName: z.string() });

const latest = (...dates: (Date | null | undefined)[]) =>
  dates.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);

/** Painel do admin geral: visão de todas as oficinas. Nenhuma outra conta acessa. */
export function createAdminRouter({ db, bus, cognito }: ApiDeps) {
  const r = Router();

  async function findWorkspace(id: string) {
    const [w] = id === UNASSIGNED_WORKSPACE ? [] : await db.select().from(workspaces).where(eq(workspaces.id, id));
    if (!w) throw new ApiError(404, 'NOT_FOUND', 'Oficina não encontrada.');
    return w;
  }

  r.get('/admin/overview', requireSuperAdmin, asyncHandler(async (_req, res) => {
    const [wsRows, userRows, prodAgg, osAgg, txAgg] = await Promise.all([
      // A área de cadastros sem oficina tem a própria fila (/signups); não entra aqui.
      db.select().from(workspaces).where(ne(workspaces.id, UNASSIGNED_WORKSPACE)).orderBy(asc(workspaces.createdAt)),
      db.select({
        id: users.id, workspaceId: users.workspaceId, name: users.name, email: users.email,
        role: users.role, status: users.status, createdAt: users.createdAt,
      }).from(users).where(ne(users.workspaceId, UNASSIGNED_WORKSPACE)).orderBy(asc(users.name)),
      db.select({
        workspaceId: products.workspaceId,
        count: count(),
        lowStock: sql<number>`(count(*) filter (where ${products.quantity} <= ${products.minQuantity}))::int`,
        stockValue: sql<number>`coalesce(sum(${products.quantity} * coalesce(${products.price}, 0)), 0)::float`,
      }).from(products).groupBy(products.workspaceId),
      db.select({
        workspaceId: serviceOrders.workspaceId,
        count: count(),
        open: sql<number>`(count(*) filter (where ${serviceOrders.status} in ('draft', 'in_progress')))::int`,
        revenue: sql<number>`coalesce(sum(${serviceOrders.totalAmount}) filter (where ${serviceOrders.status} = 'paid'), 0)::float`,
        revenue30d: sql<number>`coalesce(sum(${serviceOrders.totalAmount}) filter (where ${serviceOrders.status} = 'paid' and ${serviceOrders.paidAt} > now() - interval '30 days'), 0)::float`,
        lastUpdate: max(serviceOrders.updatedAt),
      }).from(serviceOrders).groupBy(serviceOrders.workspaceId),
      db.select({ workspaceId: transactions.workspaceId, last: max(transactions.timestamp) })
        .from(transactions).groupBy(transactions.workspaceId),
    ]);

    const byWs = <T extends { workspaceId: string }>(rows: T[]) => new Map(rows.map((x) => [x.workspaceId, x]));
    const prods = byWs(prodAgg);
    const oss = byWs(osAgg);
    const txs = byWs(txAgg);

    const list = wsRows.map((w) => {
      const p = prods.get(w.id);
      const o = oss.get(w.id);
      return {
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
        users: userRows.filter((u) => u.workspaceId === w.id),
        productCount: p?.count ?? 0,
        lowStockCount: p?.lowStock ?? 0,
        stockValue: p?.stockValue ?? 0,
        serviceOrderCount: o?.count ?? 0,
        openServiceOrders: o?.open ?? 0,
        revenue: o?.revenue ?? 0,
        revenue30d: o?.revenue30d ?? 0,
        lastActivity: latest(txs.get(w.id)?.last, o?.lastUpdate),
      };
    });

    res.json({
      totals: {
        workspaces: list.length,
        users: userRows.length,
        products: list.reduce((a, w) => a + w.productCount, 0),
        serviceOrders: list.reduce((a, w) => a + w.serviceOrderCount, 0),
        revenue: list.reduce((a, w) => a + w.revenue, 0),
        revenue30d: list.reduce((a, w) => a + w.revenue30d, 0),
      },
      workspaces: list,
    });
  }));

  /** Renomeia a oficina (e o nome exibido nas configurações dela). */
  r.patch('/admin/workspaces/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
    const { name } = renameInput.parse(req.body);
    const w = await findWorkspace(req.params.id);
    await db.update(workspaces).set({ name }).where(eq(workspaces.id, w.id));
    await mergeSettings(db, w.id, { storeName: name });
    bus.emitChange('workspaces', 'settings');
    res.json({ ...w, name });
  }));

  /**
   * Exclui a oficina com tudo dela (produtos, OS, movimentações, alertas, backups, usuários).
   * Irreversível: exige o nome exato da oficina no corpo. As contas de login (Cognito) dos
   * usuários também são removidas, para ninguém entrar numa oficina que não existe mais.
   */
  r.delete('/admin/workspaces/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
    const { confirmName } = deleteInput.parse(req.body ?? {});
    const w = await findWorkspace(req.params.id);
    if (w.id === req.user!.workspaceId) {
      throw new ApiError(400, 'OWN_WORKSPACE', 'Você não pode excluir a sua própria oficina.');
    }
    if (confirmName.trim() !== w.name) {
      throw new ApiError(400, 'CONFIRMATION_MISMATCH', 'Digite o nome exato da oficina para confirmar.');
    }

    const members = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.workspaceId, w.id));
    for (const m of members) {
      try {
        await cognito.deleteUser(m.email);
      } catch (e) {
        if ((e as { name?: string })?.name !== 'UserNotFoundException') throw e;
      }
    }

    await db.transaction(async (tx) => {
      if (members.length) await tx.delete(aiSearches).where(inArray(aiSearches.userId, members.map((m) => m.id)));
      await tx.delete(settings).where(eq(settings.id, w.id));
      // FK ON DELETE CASCADE apaga usuários, produtos, categorias, OS, movimentações, alertas e backups.
      await tx.delete(workspaces).where(eq(workspaces.id, w.id));
    });
    bus.emitChange('workspaces', 'users', 'products', 'categories', 'serviceOrders', 'transactions', 'notifications', 'settings');
    res.status(204).end();
  }));

  return r;
}
