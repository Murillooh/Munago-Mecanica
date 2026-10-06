import { Router } from 'express';
import { z } from 'zod';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { accessRequests, users } from '../db/schema';
import { ROLE_PERMISSIONS, effectivePermissions, requirePermission, type AuthUser, type Role } from '../auth/middleware';
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

  /** Cria no Cognito (convite por e-mail) e no banco, já aprovado. */
  async function createUser(input: z.infer<typeof newUserInput>, actor: AuthUser) {
    if (input.role === 'admin' && actor.role !== 'admin') {
      throw new ApiError(403, 'ADMIN_ONLY', 'Apenas administradores podem criar outros administradores.');
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`);
    if (existing) throw new ApiError(409, 'USER_EXISTS', 'Já existe um usuário com este e-mail.');

    const sub = await cognito.createUser(input.email, input.name);
    const [row] = await db.insert(users).values({
      id: sub,
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
  r.get('/me', (req, res) => {
    res.json(withPermissions(req.user!));
  });

  r.get('/users', requirePermission('canManageUsers'), asyncHandler(async (_req, res) => {
    const rows = await db.select().from(users).orderBy(asc(users.name));
    res.json(rows.map(withPermissions));
  }));

  r.post('/users', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const row = await createUser(newUserInput.parse(req.body), req.user!);
    res.status(201).json(withPermissions(row));
  }));

  r.patch('/users/:id', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const patch = userPatch.parse(req.body);
    const actor = req.user!;
    const [target] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Usuário não encontrado.');

    // Só admin mexe em admin ou promove a admin (evita escalada de privilégio).
    if (actor.role !== 'admin' && (target.role === 'admin' || patch.role === 'admin')) {
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
    const [target] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!target) return res.status(204).end();
    if (target.role === 'admin' && actor.role !== 'admin') {
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

  // ---- Solicitações de acesso ----

  r.get('/access-requests', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const status = z.enum(['pending', 'approved', 'rejected']).optional().parse(req.query.status);
    const q = db.select().from(accessRequests).orderBy(desc(accessRequests.timestamp));
    res.json(status ? await q.where(eq(accessRequests.status, status)) : await q);
  }));

  r.post('/access-requests/:id/approve', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
    const { role: chosenRole, permissions: perms } = z.object({ role, permissions: permissions.optional() }).parse(req.body);
    const [request] = await db.select().from(accessRequests).where(eq(accessRequests.id, req.params.id));
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'Solicitação não encontrada.');
    if (request.status !== 'pending') throw new ApiError(409, 'ALREADY_HANDLED', 'Esta solicitação já foi analisada.');

    const user = await createUser({ email: request.email, name: request.name, role: chosenRole, permissions: perms }, req.user!);
    await db.update(accessRequests).set({ status: 'approved' }).where(eq(accessRequests.id, request.id));
    bus.emitChange('accessRequests');
    res.json({ user: withPermissions(user) });
  }));

  r.post('/access-requests/:id/reject', requirePermission('canManageUsers'), asyncHandler(async (req, res) => {
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
