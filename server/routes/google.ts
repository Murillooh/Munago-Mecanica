import { Router } from 'express';
import { requirePermission } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import type { GoogleOAuth } from '../google/oauth';

const notConnected = () => new ApiError(404, 'GOOGLE_NOT_CONNECTED', 'Conecte sua conta Google para continuar.');

/** Conta Google do usuário logado (backup no Drive). Tokens ficam no servidor. */
export function createGoogleRouter(g: GoogleOAuth) {
  const r = Router();
  const guard = requirePermission();

  r.get('/google/status', guard, asyncHandler(async (req, res) => {
    res.json({ configured: g.configured, ...(await g.status(req.user!.id)) });
  }));

  r.get('/google/auth-url', guard, (req, res) => {
    res.json({ url: g.authUrl(req.user!.id) });
  });

  // Só o access_token (vale ~1h): o navegador fala direto com a API do Drive.
  r.get('/google/access-token', guard, asyncHandler(async (req, res) => {
    const t = await g.accessToken(req.user!.id);
    if (!t) throw notConnected();
    res.set('Cache-Control', 'no-store').json(t);
  }));

  r.delete('/google/connection', guard, asyncHandler(async (req, res) => {
    await g.disconnect(req.user!.id);
    res.status(204).end();
  }));

  return r;
}
