import { Router, type RequestHandler } from 'express';
import { authMiddleware, requirePermission, type TokenVerifier } from './auth/middleware';
import { sseHandler, sseTokenFromQuery } from './realtime/sse';
import type { ApiDeps } from './routes/deps';
import { createSettingsRouter } from './routes/settings';
import { createProductsRouter } from './routes/products';
import { createCategoriesRouter } from './routes/categories';
import { createTransactionsRouter } from './routes/transactions';
import { createAsaasWebhookRouter, createServiceOrdersRouter } from './routes/serviceOrders';
import { createServicesRouter } from './routes/services';
import { createNotificationsRouter } from './routes/notifications';
import { createUsersRouter, createPublicAccessRequestRouter } from './routes/users';
import { createAiSearchesRouter } from './routes/aiSearches';
import { createBackupsRouter } from './routes/backups';
import { createAdminRouter } from './routes/admin';

export interface ApiOptions extends ApiDeps {
  verifier: TokenVerifier;
  bootstrapAdmins: string[];
  /** Rate limit da rota pública de solicitação de acesso. */
  publicLimiter?: RequestHandler;
  /** Token que o Asaas envia no webhook (ASAAS_WEBHOOK_TOKEN); sem ele o webhook recusa tudo. */
  asaasWebhookToken?: string;
  /** Rotas autenticadas extras (ex.: SSE), montadas depois do auth. */
  extra?: (r: Router) => void;
}

/** Monta /api/v1: rotas públicas primeiro, depois auth Cognito + rotas protegidas. */
export function createApiRouter(opts: ApiOptions): Router {
  const api = Router();
  const deps: ApiDeps = { db: opts.db, bus: opts.bus, cognito: opts.cognito, payments: opts.payments };

  const pub = createPublicAccessRequestRouter(deps);
  if (opts.publicLimiter) api.post('/access-requests', opts.publicLimiter);
  api.use(pub);
  api.use(createAsaasWebhookRouter(deps, opts.asaasWebhookToken));

  api.use(sseTokenFromQuery);
  api.use(authMiddleware({ db: opts.db, verifier: opts.verifier, bootstrapAdmins: opts.bootstrapAdmins }));
  api.get('/events', requirePermission(), sseHandler(opts.bus));
  opts.extra?.(api);

  for (const make of [
    createUsersRouter, createSettingsRouter, createProductsRouter, createCategoriesRouter,
    createTransactionsRouter, createServicesRouter, createServiceOrdersRouter, createNotificationsRouter, createAiSearchesRouter, createBackupsRouter, createAdminRouter,
  ]) {
    api.use(make(deps));
  }
  return api;
}
