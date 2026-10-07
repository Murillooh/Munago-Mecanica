import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { google, type Auth } from 'googleapis';
import { googleConnections } from '../db/schema';
import type { DB } from '../db/client';
import { ApiError } from '../middleware/errorHandler';

export type GooglePurpose = 'drive' | 'sheets';

const BASE_SCOPES = [
  // Backup/restauração no Google Drive (só arquivos criados pelo app)
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const STATE_TTL_MS = 10 * 60 * 1000;
// Renova um pouco antes de expirar para o navegador não receber token prestes a vencer.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export interface GoogleOAuthConfig {
  db: DB;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  /** Testes injetam um cliente falso. */
  makeClient?: () => Pick<Auth.OAuth2Client, 'generateAuthUrl' | 'getToken' | 'setCredentials' | 'refreshAccessToken' | 'revokeToken'>;
}

const b64url = (b: Buffer) => b.toString('base64url');

/** Chaves derivadas do client secret: sem variável nova, e trocar o secret invalida tudo junto. */
function deriveKey(secret: string, label: string) {
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'munago-google', label, 32));
}

export function encryptJson(key: Buffer, value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b64url).join('.');
}

export function decryptJson<T>(key: Buffer, payload: string): T {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}

/**
 * E-mail do id_token que o próprio Google devolveu na troca do code (canal TLS direto com o Google),
 * por isso basta ler o payload. Só para exibição; nunca usar para autorizar nada.
 */
export function emailFromIdToken(idToken?: string | null): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const { email } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: unknown };
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}

interface StatePayload { u: string; exp: number; n: string }

export function signState(key: Buffer, userId: string, now = Date.now()): string {
  const body = b64url(Buffer.from(JSON.stringify({ u: userId, exp: now + STATE_TTL_MS, n: b64url(crypto.randomBytes(16)) })));
  return `${body}.${b64url(crypto.createHmac('sha256', key).update(body).digest())}`;
}

/** Devolve o userId de um state válido e não expirado; senão null. */
export function verifyState(key: Buffer, state: string, now = Date.now()): string | null {
  const [body, mac] = state.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', key).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    return typeof p.u === 'string' && p.exp > now ? p.u : null;
  } catch {
    return null;
  }
}

export type GoogleOAuth = ReturnType<typeof createGoogleOAuth>;

/**
 * OAuth do Google para Drive/Planilhas. Os tokens (com refresh_token) ficam cifrados no banco,
 * por usuário; o navegador só recebe access_token de curta duração.
 */
export function createGoogleOAuth(cfg: GoogleOAuthConfig) {
  const configured = Boolean(cfg.clientId && cfg.clientSecret);
  const secret = cfg.clientSecret ?? 'unconfigured';
  const stateKey = deriveKey(secret, 'state');
  const tokenKey = deriveKey(secret, 'tokens');
  const makeClient = cfg.makeClient ?? (() => new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri));

  const assertConfigured = () => {
    if (!configured) throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Login com Google não configurado no servidor.');
  };

  async function load(userId: string): Promise<Auth.Credentials | null> {
    const [row] = await cfg.db.select().from(googleConnections).where(eq(googleConnections.userId, userId));
    if (!row) return null;
    try {
      return decryptJson<Auth.Credentials>(tokenKey, row.tokens);
    } catch {
      // Secret trocado ou dado corrompido: trata como desconectado.
      return null;
    }
  }

  async function save(userId: string, tokens: Auth.Credentials) {
    const enc = encryptJson(tokenKey, tokens);
    await cfg.db.insert(googleConnections).values({ userId, tokens: enc, scope: tokens.scope ?? null })
      .onConflictDoUpdate({ target: googleConnections.userId, set: { tokens: enc, scope: tokens.scope ?? null, updatedAt: new Date() } });
  }

  /** Credenciais válidas (renovadas se preciso) ou null se o usuário não conectou o Google. */
  async function freshCredentials(userId: string): Promise<Auth.Credentials | null> {
    const tokens = await load(userId);
    if (!tokens) return null;
    if (tokens.access_token && (tokens.expiry_date ?? 0) > Date.now() + REFRESH_MARGIN_MS) return tokens;
    if (!tokens.refresh_token) return null;

    const client = makeClient();
    client.setCredentials(tokens);
    try {
      const { credentials } = await client.refreshAccessToken();
      // O Google nem sempre devolve o refresh_token de novo.
      const merged = { ...tokens, ...credentials, refresh_token: credentials.refresh_token ?? tokens.refresh_token };
      await save(userId, merged);
      return merged;
    } catch {
      // Acesso revogado na conta Google: exige reconectar.
      await cfg.db.delete(googleConnections).where(eq(googleConnections.userId, userId));
      return null;
    }
  }

  return {
    configured,

    authUrl(userId: string, purpose: GooglePurpose) {
      assertConfigured();
      return makeClient().generateAuthUrl({
        access_type: 'offline',
        scope: purpose === 'sheets' ? [...BASE_SCOPES, SHEETS_SCOPE] : BASE_SCOPES,
        // Mantém o que o usuário já autorizou (ex.: Drive) ao pedir planilhas depois.
        include_granted_scopes: true,
        prompt: 'consent',
        state: signState(stateKey, userId),
        redirect_uri: cfg.redirectUri,
      });
    },

    /** Troca o code pelos tokens do usuário que iniciou o fluxo (vem do state assinado). */
    async handleCallback(code: string, state: string) {
      assertConfigured();
      const userId = verifyState(stateKey, state);
      if (!userId) throw new ApiError(400, 'INVALID_STATE', 'Sessão de autorização inválida ou expirada.');
      const { tokens } = await makeClient().getToken(code);
      const previous = await load(userId);
      await save(userId, { ...tokens, refresh_token: tokens.refresh_token ?? previous?.refresh_token });
    },

    async status(userId: string) {
      const [row] = await cfg.db.select({ scope: googleConnections.scope }).from(googleConnections)
        .where(eq(googleConnections.userId, userId));
      // E-mail da conta Google conectada, para a tela mostrar qual conta está ligada.
      const email = row ? emailFromIdToken((await load(userId))?.id_token) : null;
      return { connected: Boolean(row), sheets: Boolean(row?.scope?.includes(SHEETS_SCOPE)), email };
    },

    async accessToken(userId: string) {
      const c = await freshCredentials(userId);
      return c?.access_token ? { accessToken: c.access_token, expiresAt: c.expiry_date ?? null } : null;
    },

    /** Cliente autenticado para chamadas feitas pelo servidor (ex.: Planilhas). */
    async client(userId: string) {
      const c = await freshCredentials(userId);
      if (!c) return null;
      const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
      client.setCredentials(c);
      return client;
    },

    async disconnect(userId: string) {
      const tokens = await load(userId);
      await cfg.db.delete(googleConnections).where(eq(googleConnections.userId, userId));
      const t = tokens?.refresh_token ?? tokens?.access_token;
      if (t) await makeClient().revokeToken(t).catch(() => {});
    },
  };
}
