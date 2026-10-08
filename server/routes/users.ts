import { Router } from 'express';
import { z } from 'zod';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { accessRequests, users, workspaces } from '../db/schema';
import { ROLE_PERMISSIONS, effectivePermissions, requirePermission, requireSuperAdmin, ws, type AuthUser, type Role } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

const role = z.enum(['admin', 'editor', 'viewer']);
const permissions = z.object({
  canManageInventory: z.boolean(),
  canManageOS: z.boolean(),
  canManageUsers: z.boolean(),
  canViewReports: z.boolean(),
  canPerformTransactions: z.boolean(),
});

const newUserInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(100),
  role,
  permissions: permissions.optional(),
});

const userPatch = z.object({
  name: z.string().trim().min(1).max(100),
  role,
  permissions,
  status: z.enum(['pending', 'approved', 'denied']),
}).partial().strict();

const accessRequestInput = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  workshopName: z.string().trim().min(1).max(200),
  phone: z.string().max(50).optional(),
  message: z.string().max(2000).optional(),
});

const withPermissions = (u: AuthUser) => ({ ...u, permissions: effectivePermissions(u) });

export function createUsersRouter({ db, bus, cognito }: ApiDeps) {
  const r = Router();

  const isAdmin = (u: AuthUser) => u.role === 'admin' || !!u.isSuperAdmin;

  /** Cria no Cognito (convite por e-mail) e no banco, já aprovado, dentro da oficina indicada. */
  async function createUser(input: z.infer<typeof newUserInput>, actor: AuthUser, workspaceId: string) {
    if (input.role === 'admin' && !isAdmin(actor)) {
      throw new ApiError(403, 'ADMIN_ONLY', 'Apenas administradores podem criar outros administradores.');
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`);
    // Um e-mail pertence a uma oficina só; a mensagem não revela qual.
    if (existing) throw new ApiError(409, 'USER_EXISTS', 'Este e-mail já tem cadastro no sistema.');

    const sub = await cognito.createUser(input.email, input.name);
    const [row] = await db.insert(users).values({
      id: sub,
      workspaceId,
      email: input.email,
      name: input.name,
      role: input.role,
      status: 'approved',
      permissions: input.permissions ?? ROLE_PERMISSIONS[input.role as Role],
    }).returning();
    bus.emitChange('users');
    return row;
  }

  // Sem requirePermission: usuário pendente precisa ler o próprio status.
  r.get('/me', asyncHandler(async (req, res) => {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, ws(req)));
    res.json({ ...withPermissions(req.user!), isSuperAdmin: !!req.user!.isSuperAdmin, workspace: workspace ?? null });
  }));

  /** Oficinas visíveis: todas para o admin geral, só a própria para os demais. */
  r.get('/workspaces', requirePermission(), asyncHandler(async (req, res) => {
    const rows = await db.select({ id: workspaces.id, name: workspaces.name, createdAt: workspaces.createdAt, userCount: count(users.id) })
      .from(workspaces)
      .leftJoin(users, eq(users.workspaceId, workspaces.id))
      .where(req.user!.isSuperAdmin ? undefined : eq(workspaces.id, req.user!.workspaceId))
      .groupBy(workspaces.id)
      .orderBy(asc(workspaces.name));
    res.json(rows);
  }));

  const inWorkspace = (workspaceId: string, id: string) => and(eq(users.workspaceId, workspaceId), eq(users.id, id));

  r.get('/users', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const rows = await db.select().from(users).where(eq(users.workspaceId, ws(req))).orderBy(asc(users.name));
    res.json(rows.map(withPermissions));
  }));

  r.post('/users', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const row = await createUser(newUserInput.parse(req.body), req.user!, ws(req));
    res.status(201).json(withPermissions(row));
  }));

  r.patch('/users/:id', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const patch = userPatch.parse(req.body);
    const actor = req.user!;
    const [target] = await db.select().from(users).where(inWorkspace(ws(req), req.params.id));
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');

    // Só admin mexe em admin ou promove a admin (evita escalada de privilégio).
    if (!isAdmin(actor) && (target.role === 'admin' || patch.role === 'admin')) {
      throw new ApiError(403, 'ADMIN_ONLY', 'Apenas administradores podem alterar administradores.');
    }
    if (target.id === actor.id && ((patch.role && patch.role !== target.role) || (patch.status && patch.status !== 'approved'))) {
      throw new ApiError(400, 'SELF_LOCKOUT', 'Você não pode alterar o próprio cargo ou status.');
    }

    const set: Partial<typeof users.$inferInsert> = { ...patch };
    if (patch.role && !patch.permissions) set.permissions = ROLE_PERMISSIONS[patch.role];
    const [row] = await db.update(users).set(set).where(eq(users.id, target.id)).returning();
    bus.emitChange('users');
    res.json(withPermissions(row));
  }));

  r.delete('/users/:id', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const actor = req.user!;
    if (req.params.id === actor.id) throw new ApiError(400, 'SELF_LOCKOUT', 'Você não pode excluir a si mesmo.');
    const [target] = await db.select().from(users).where(inWorkspace(ws(req), req.params.id));
    if (!target) return res.status(204).end();
    if (target.role === 'admin' && !isAdmin(actor)) {
      throw new ApiError(403, 'ADMIN_ONLY', 'Apenas administradores podem excluir administradores.');
    }
    try {
      await cognito.deleteUser(target.email);
    } catch (e) {
      // Usuário migrado que nunca entrou pode não existir no Cognito.
      if ((e as { name?: string })?.name !== 'UserNotFoundException') throw e;
    }
    await db.delete(users).where(eq(users.id, target.id));
    bus.emitChange('users');
    res.status(204).end();
  }));

  // ---- Solicitações de acesso (formulário público): só o admin geral analisa ----

  r.get('/access-requests', requireSuperAdmin, asyncHandler(async (req, res) => {
    const status = z.enum(['pending', 'approved', 'rejected']).optional().parse(req.query.status);
    const q = db.select().from(accessRequests).orderBy(desc(accessRequests.timestamp));
    res.json(status ? await q.where(eq(accessRequests.status, status)) : await q);
  }));

  // Aprovar cria uma oficina nova (com o nome informado) e o solicitante como admin dela.
  r.post('/access-requests/:id/approve', requireSuperAdmin, asyncHandler(async (req, res) => {
    const [request] = await db.select().from(accessRequests).where(eq(accessRequests.id, req.params.id));
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'Solicitação não encontrada.');
    if (request.status !== 'pending') throw new ApiError(409, 'ALREADY_HANDLED', 'Esta solicitação já foi analisada.');

    const workspaceId = newId();
    await db.insert(workspaces).values({ id: workspaceId, name: request.workshopName });
    let user;
    try {
      user = await createUser({ email: request.email, name: request.name, role: 'admin' }, req.user!, workspaceId);
    } catch (e) {
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
      throw e;
    }
    bus.emitChange('workspaces');
    await db.update(accessRequests).set({ status: 'approved' }).where(eq(accessRequests.id, request.id));
    bus.emitChange('accessRequests');
    res.json({ user: withPermissions(user) });
  }));

  r.post('/access-requests/:id/reject', requireSuperAdmin, asyncHandler(async (req, res) => {
    const [row] = await db.update(accessRequests).set({ status: 'rejected' })
      .where(eq(accessRequests.id, req.params.id)).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Solicitação não encontrada.');
    bus.emitChange('accessRequests');
    res.json(row);
  }));

  return r;
}

/** Rota pública (sem login): formulário "solicitar acesso" da tela de login. */
export function createPublicAccessRequestRouter({ db, bus }: Pick<ApiDeps, 'db' | 'bus'>) {
  const r = Router();
  r.post('/access-requests', asyncHandler(async (req, res) => {
    const data = accessRequestInput.parse(req.body);
    await db.insert(accessRequests).values({ id: newId(), ...data, status: 'pending' });
    bus.emitChange('accessRequests');
    // Não devolve o registro: rota pública.
    res.status(201).json({ ok: true });
  }));
  return r;
}
