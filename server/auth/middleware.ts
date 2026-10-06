import type { RequestHandler } from 'express';
import { eq, sql } from 'drizzle-orm';
import { users, type Permissions } from '../db/schema';
import type { DB } from '../db/client';

export type Role = 'admin' | 'editor' | 'viewer';
export type AuthUser = typeof users.$inferSelect;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

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
 * Valida o ID token do Cognito e carrega o perfil em `req.user`.
 * No primeiro acesso: vincula usuário migrado/pré-cadastrado pelo e-mail (só se verificado)
 * ou cria um perfil novo (admin aprovado se o e-mail estiver em bootstrapAdmins, senão viewer pendente).
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

        const isBootstrap = emailVerified && admins.has(email);
        const role: Role = isBootstrap ? 'admin' : 'viewer';
        const [created] = await tx.insert(users).values({
          id: claims.sub,
          email,
          name,
          role,
          status: isBootstrap ? 'approved' : 'pending',
          permissions: ROLE_PERMISSIONS[role],
        }).returning();
        return { user: created };
      });

      if ('denied' in result && result.denied) return res.status(result.denied.status).json(result.denied.body);
      req.user = result.user;
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function effectivePermissions(u: Pick<AuthUser, 'role' | 'permissions'>): Permissions {
  if (u.role === 'admin') return ROLE_PERMISSIONS.admin;
  return u.permissions && Object.keys(u.permissions).length ? u.permissions : ROLE_PERMISSIONS[u.role];
}

/** Exige usuário aprovado (admin sempre passa) e, opcionalmente, uma permissão. Substitui firestore.rules. */
export function requirePermission(perm?: keyof Permissions): RequestHandler {
  return (req, res, next) => {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'Autenticação necessária.', code: 'UNAUTHENTICATED' });
    if (u.role !== 'admin' && u.status !== 'approved') {
      return res.status(403).json({ error: 'Seu acesso ainda não foi aprovado.', code: 'NOT_APPROVED' });
    }
    if (perm && !effectivePermissions(u)[perm]) {
      return res.status(403).json({ error: 'Você não tem permissão para esta ação.', code: 'FORBIDDEN' });
    }
    next();
  };
}

export const requireAdmin: RequestHandler = (req, res, next) =>
  req.user?.role === 'admin'
    ? next()
    : res.status(403).json({ error: 'Apenas administradores.', code: 'ADMIN_ONLY' });
