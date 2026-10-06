import { Router, type RequestHandler } from 'express';
import { authMiddleware, type TokenVerifier } from './auth/middleware';
import type { ApiDeps } from './routes/deps';
import { createSettingsRouter } from './routes/settings';
import { createProductsRouter } from './routes/products';
import { createCategoriesRouter } from './routes/categories';
import { createTransactionsRouter } from './routes/transactions';
import { createServiceOrdersRouter } from './routes/serviceOrders';
import { createNotificationsRouter } from './routes/notifications';
import { createUsersRouter, createPublicAccessRequestRouter } from './routes/users';
import { createAiSearchesRouter } from './routes/aiSearches';

export interface ApiOptions extends ApiDeps {
  verifier: TokenVerifier;
  bootstrapAdmins: string[];
  /** Rate limit da rota pública de solicitação de acesso. */
  publicLimiter?: RequestHandler;
  /** Rotas autenticadas extras (ex.: SSE), montadas depois do auth. */
  extra?: (r: Router) => void;
}

/** Monta /api/v1: rotas públicas primeiro, depois auth Cognito + rotas protegidas. */
export function createApiRouter(opts: ApiOptions): Router {
  const api = Router();
  const deps: ApiDeps = { db: opts.db, bus: opts.bus, cognito: opts.cognito };

  const pub = createPublicAccessRequestRouter(deps);
  if (opts.publicLimiter) api.post('/access-requests', opts.publicLimiter);
  api.use(pub);

  api.use(authMiddleware({ db: opts.db, verifier: opts.verifier, bootstrapAdmins: opts.bootstrapAdmins }));
  opts.extra?.(api);

  for (const make of [
    createUsersRouter, createSettingsRouter, createProductsRouter, createCategoriesRouter,
    createTransactionsRouter, createServiceOrdersRouter, createNotificationsRouter, createAiSearchesRouter,
  ]) {
    api.use(make(deps));
  }
  return api;
}
