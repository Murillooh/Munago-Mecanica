import { Router } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';
import { requirePermission } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import type { GoogleOAuth } from '../google/oauth';

const notConnected = () => new ApiError(404, 'GOOGLE_NOT_CONNECTED', 'Conecte sua conta Google para continuar.');

const sheetsQuery = z.object({
  spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/, 'ID de planilha inválido'),
  range: z.string().min(1).max(200).default('A1:Z100'),
});

/** Conta Google do usuário logado (Drive/Planilhas). Tokens ficam no servidor. */
export function createGoogleRouter(g: GoogleOAuth) {
  const r = Router();
  const guard = requirePermission();

  r.get('/google/status', guard, asyncHandler(async (req, res) => {
    res.json({ configured: g.configured, ...(await g.status(req.user!.id)) });
  }));

  r.get('/google/auth-url', guard, (req, res) => {
    const purpose = req.query.purpose === 'sheets' ? 'sheets' : 'drive';
    res.json({ url: g.authUrl(req.user!.id, purpose) });
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

  r.get('/google/sheets', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const { spreadsheetId, range } = sheetsQuery.parse(req.query);
    const auth = await g.client(req.user!.id);
    if (!auth) throw notConnected();
    try {
      const response = await google.sheets({ version: 'v4', auth }).spreadsheets.values.get({ spreadsheetId, range });
      res.json({ values: response.data.values ?? [] });
    } catch (e) {
      const err = e as { code?: number; message?: string };
      // Conta conectada só para o Drive: falta autorizar a leitura de planilhas.
      if (err.code === 403 && /insufficient.*scope/i.test(err.message ?? '')) {
        throw new ApiError(403, 'SHEETS_SCOPE_REQUIRED', 'Sua conta Google está conectada só para o backup. Clique em Conectar Google para autorizar a leitura de planilhas.');
      }
      if (err.code === 403 || err.code === 404) {
        throw new ApiError(err.code, 'SHEET_UNAVAILABLE', 'Planilha não encontrada ou sem acesso para esta conta Google.');
      }
      if (err.code === 400) throw new ApiError(400, 'SHEET_BAD_RANGE', 'Intervalo da planilha inválido.');
      throw e;
    }
  }));

  return r;
}
