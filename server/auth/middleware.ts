import type { RequestHandler } from 'express';
import { eq, sql } from 'drizzle-orm';
import { UNASSIGNED_WORKSPACE, users, workspaces, type Permissions } from '../db/schema';
import type { DB } from '../db/client';

export type Role = 'admin' | 'editor' | 'viewer';
export type AuthUser = typeof users.$inferSelect & {
  /** E-mail em BOOTSTRAP_ADMIN_EMAILS: admin geral, enxerga e administra todas as oficinas. */
  isSuperAdmin?: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Oficina ativa da requisição. Toda query de dados operacionais filtra por ela. */
      workspaceId?: string;
    }
  }
}

/** Header com que o admin geral escolhe qual oficina está administrando. */
export const WORKSPACE_HEADER = 'x-workspace-id';

export const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  admin:  { canManageInventory: true,  canPerformTransactions: true,  canManageOS: true,  canViewReports: true, canManageUsers: true },
  editor: { canManageInventory: true,  canPerformTransactions: true,  canManageOS: true,  canViewReports: true, canManageUsers: false },
  viewer: { canManageInventory: false, canPerformTransactions: false, canManageOS: false, canViewReports: true, canManageUsers: false },
};

export interface TokenClaims {
  sub: string;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
}

export interface TokenVerifier {
  verify(token: string): Promise<TokenClaims>;
}

const deny = (status: number, code: string, error: string) => ({ status, body: { error, code } });

/**
 * Valida o ID token do Cognito e carrega o perfil em `req.user` e a oficina em `req.workspaceId`.
 * No primeiro acesso: vincula usuário pré-cadastrado pelo e-mail (só se verificado) ou cria
 * uma oficina nova com o usuário como admin dela.
 */
export function authMiddleware(opts: { db: DB; verifier: TokenVerifier; bootstrapAdmins: string[] }): RequestHandler {
  const admins = new Set(opts.bootstrapAdmins.map((e) => e.trim().toLowerCase()).filter(Boolean));

  return async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      const d = deny(401, 'UNAUTHENTICATED', 'Autenticação necessária.');
      return res.status(d.status).json(d.body);
    }

    let claims: TokenClaims;
    try {
      claims = await opts.verifier.verify(token);
    } catch {
      const d = deny(401, 'INVALID_TOKEN', 'Sessão inválida ou expirada.');
      return res.status(d.status).json(d.body);
    }

    const email = String(claims.email ?? '').trim().toLowerCase();
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    const name = String(claims.name ?? '').trim() || 'Usuário';

    try {
      const result = await opts.db.transaction(async (tx) => {
        const [bySub] = await tx.select().from(users).where(eq(users.id, claims.sub));
        if (bySub) return { user: bySub };

        const [byEmail] = email
          ? await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`)
          : [];
        if (byEmail) {
          // Sem e-mail verificado, qualquer um poderia assumir a conta de outro pelo e-mail.
          if (!emailVerified) return { denied: deny(403, 'EMAIL_NOT_VERIFIED', 'E-mail não verificado.') };
          // Mesma pessoa por outro login (senha × Google têm subs diferentes no Cognito,
          // ou usuário migrado): o id interno não muda, para não quebrar o histórico.
          return { user: byEmail };
        }

        // Admin geral (instalação nova): ganha a própria oficina e é admin dela.
        if (emailVerified && admins.has(email)) {
          const workspaceId = crypto.randomUUID();
          await tx.insert(workspaces).values({ id: workspaceId, name: `Oficina de ${name}` });
          const [created] = await tx.insert(users).values({
            id: claims.sub, workspaceId, email, name,
            role: 'admin', status: 'approved', permissions: ROLE_PERMISSIONS.admin,
          }).returning();
          return { user: created };
        }

        // Demais cadastros: aguardam um admin colocá-los numa oficina (rotas /signups).
        // Viewer, não admin: admin pendente passaria pelo requireLogin.
        const [created] = await tx.insert(users).values({
          id: claims.sub,
          workspaceId: UNASSIGNED_WORKSPACE,
          email,
          name,
          role: 'viewer',
          status: 'pending',
          permissions: ROLE_PERMISSIONS.viewer,
        }).returning();
        return { user: created };
      });

      if ('denied' in result && result.denied) return res.status(result.denied.status).json(result.denied.body);
      const isSuperAdmin = emailVerified && admins.has(email);
      req.user = { ...result.user!, isSuperAdmin };
      req.workspaceId = result.user!.workspaceId;

      // Admin geral pode operar em outra oficina; o id precisa existir.
      const requested = req.headers[WORKSPACE_HEADER];
      if (isSuperAdmin && typeof requested === 'string' && requested && requested !== req.workspaceId) {
        const [ws] = requested === UNASSIGNED_WORKSPACE
          ? []
          : await opts.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, requested));
        if (!ws) return res.status(404).json({ error: 'Oficina não encontrada.', code: 'WORKSPACE_NOT_FOUND' });
        req.workspaceId = ws.id;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function effectivePermissions(u: Pick<AuthUser, 'role' | 'permissions' | 'isSuperAdmin'>): Permissions {
  if (u.role === 'admin' || u.isSuperAdmin) return ROLE_PERMISSIONS.admin;
  return u.permissions && Object.keys(u.permissions).length ? u.permissions : ROLE_PERMISSIONS[u.role];
}

/** Exige usuário aprovado (admin sempre passa) e, opcionalmente, uma permissão. Substitui firestore.rules. */
export function requirePermission(perm?: keyof Permissions): RequestHandler {
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'Autenticação necessária.', code: 'UNAUTHENTICATED' });
    if (u.role !== 'admin' && !u.isSuperAdmin && u.status !== 'approved') {
      return res.status(403).json({ error: 'Seu acesso ainda não foi aprovado.', code: 'NOT_APPROVED' });
    }
    if (perm && !effectivePermissions(u)[perm]) {
      return res.status(403).json({ error: 'Você não tem permissão para esta ação.', code: 'FORBIDDEN' });
    }
    next();
  };
}

export const requireAdmin: RequestHandler = (req, res, next) =>
  req.user?.role === 'admin' || req.user?.isSuperAdmin
    ? next()
    : res.status(403).json({ error: 'Apenas administradores.', code: 'ADMIN_ONLY' });

export const requireSuperAdmin: RequestHandler = (req, res, next) =>
  req.user?.isSuperAdmin
    ? next()
    : res.status(403).json({ error: 'Apenas o administrador geral.', code: 'SUPER_ADMIN_ONLY' });

/** Oficina ativa (definida pelo authMiddleware). */
export const ws = (req: { workspaceId?: string }) => {
  if (!req.workspaceId) throw new Error('workspaceId ausente: rota montada antes do authMiddleware');
  return req.workspaceId;
};
