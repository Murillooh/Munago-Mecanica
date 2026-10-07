import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHarness } from '../test/apiHarness';
import { googleConnections } from '../db/schema';
import { createGoogleOAuth, decryptJson, encryptJson, signState, verifyState, type GoogleOAuth } from './oauth';
import { createGoogleRouter } from '../routes/google';

type H = Awaited<ReturnType<typeof createHarness>>;

function fakeClient() {
  return {
    generateAuthUrl: vi.fn((o: { state: string; scope: string[] }) => `https://accounts.google.com/o?state=${o.state}&scope=${o.scope.join(' ')}`),
    getToken: vi.fn(async (code: string) => ({
      tokens: { access_token: `at-${code}`, refresh_token: `rt-${code}`, expiry_date: Date.now() + 3600_000, scope: 'drive.file' },
    })),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn(async () => ({ credentials: { access_token: 'at-refreshed', expiry_date: Date.now() + 3600_000 } })),
    revokeToken: vi.fn(async () => ({})),
  };
}

const stateFrom = (url: string) => new URL(url).searchParams.get('state')!;

describe('state e criptografia', () => {
  const key = crypto.randomBytes(32);

  it('state assinado devolve o usuário; adulterado ou expirado não', () => {
    const s = signState(key, 'user-1', 1_000);
    expect(verifyState(key, s, 2_000)).toBe('user-1');
    expect(verifyState(key, s, 1_000 + 11 * 60_000)).toBeNull();
    expect(verifyState(crypto.randomBytes(32), s, 2_000)).toBeNull();

    const [body, mac] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'admin', exp: 9e15, n: 'x' })).toString('base64url');
    expect(verifyState(key, `${forged}.${mac}`, 2_000)).toBeNull();
    expect(verifyState(key, body, 2_000)).toBeNull();
  });

  it('AES-GCM: ida e volta; dado alterado falha', () => {
    const enc = encryptJson(key, { refresh_token: 'segredo' });
    expect(enc).not.toContain('segredo');
    expect(decryptJson(key, enc)).toEqual({ refresh_token: 'segredo' });
    const [iv, tag, data] = enc.split('.');
    expect(() => decryptJson(key, [iv, tag, data.slice(0, -2) + 'AA'].join('.'))).toThrow();
  });
});

describe('Google OAuth', () => {
  let h: H;
  let g: GoogleOAuth;
  let client: ReturnType<typeof fakeClient>;

  beforeEach(async () => {
    client = fakeClient();
    h = await createHarness((db) => {
      g = createGoogleOAuth({ db, clientId: 'cid', clientSecret: 'secret', redirectUri: 'http://x/cb', makeClient: () => client as never });
      return (r) => r.use(createGoogleRouter(g));
    });
  });

  it('exige login aprovado', async () => {
    await h.anon.get('/api/v1/google/access-token').expect(401);
    await h.as('pending').get('/google/auth-url').expect(403);
  });

  it('callback guarda tokens cifrados para o usuário do state; navegador só recebe o access_token', async () => {
    const { url } = (await h.as('editor').get('/google/auth-url?purpose=sheets').expect(200)).body;
    expect(url).toContain('spreadsheets.readonly');

    await g.handleCallback('abc', stateFrom(url));
    const [row] = await h.db.select().from(googleConnections);
    expect(row.userId).toBe('editor');
    expect(row.tokens).not.toContain('rt-abc');

    const res = await h.as('editor').get('/google/access-token').expect(200);
    expect(res.body).toEqual({ accessToken: 'at-abc', expiresAt: expect.any(Number) });
    expect(JSON.stringify(res.body)).not.toContain('rt-');

    // Outro usuário não enxerga a conexão do editor.
    await h.as('viewer').get('/google/access-token').expect(404);
  });

  it('status mostra a conta Google conectada (e-mail do id_token)', async () => {
    const payload = Buffer.from(JSON.stringify({ email: 'oficina@exemplo.com', email_verified: true })).toString('base64url');
    client.getToken.mockResolvedValueOnce({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600_000, scope: 'drive.file', id_token: `h.${payload}.sig` } } as never);
    expect((await h.as('editor').get('/google/status').expect(200)).body).toMatchObject({ connected: false, email: null });

    const { url } = (await h.as('editor').get('/google/auth-url').expect(200)).body;
    await g.handleCallback('abc', stateFrom(url));
    expect((await h.as('editor').get('/google/status').expect(200)).body).toMatchObject({ connected: true, email: 'oficina@exemplo.com' });
  });

  it('callback com state inválido não grava nada', async () => {
    await expect(g.handleCallback('abc', 'lixo.lixo')).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(client.getToken).not.toHaveBeenCalled();
    expect(await h.db.select().from(googleConnections)).toHaveLength(0);
  });

  it('renova o access_token vencido mantendo o refresh_token', async () => {
    client.getToken.mockResolvedValueOnce({ tokens: { access_token: 'velho', refresh_token: 'rt', expiry_date: Date.now() - 1000, scope: 'x' } });
    await g.handleCallback('c', stateFrom(g.authUrl('editor', 'drive')));

    expect(await g.accessToken('editor')).toMatchObject({ accessToken: 'at-refreshed' });
    expect(client.refreshAccessToken).toHaveBeenCalledOnce();
    // Segunda chamada usa o token salvo, sem renovar de novo.
    expect(await g.accessToken('editor')).toMatchObject({ accessToken: 'at-refreshed' });
    expect(client.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('acesso revogado no Google: remove a conexão', async () => {
    client.getToken.mockResolvedValueOnce({ tokens: { access_token: 'velho', refresh_token: 'rt', expiry_date: 0, scope: 'x' } });
    await g.handleCallback('c', stateFrom(g.authUrl('editor', 'drive')));
    client.refreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));

    expect(await g.accessToken('editor')).toBeNull();
    expect(await h.db.select().from(googleConnections)).toHaveLength(0);
  });

  it('desconectar apaga e revoga', async () => {
    await g.handleCallback('abc', stateFrom(g.authUrl('editor', 'drive')));
    await h.as('editor').del('/google/connection').expect(204);
    expect(client.revokeToken).toHaveBeenCalledWith('rt-abc');
    expect((await h.as('editor').get('/google/status').expect(200)).body).toMatchObject({ connected: false });
  });

  it('planilhas: valida o ID e exige canManageInventory', async () => {
    await h.as('viewer').get('/google/sheets?spreadsheetId=abcdefghijk').expect(403);
    await h.as('editor').get('/google/sheets?spreadsheetId=../../x').expect(400);
    await h.as('editor').get('/google/sheets?spreadsheetId=abcdefghijk').expect(404);
  });
});
