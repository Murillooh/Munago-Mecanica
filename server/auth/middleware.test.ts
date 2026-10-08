import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../test/testDb';
import { authMiddleware, requirePermission, requireAdmin, effectivePermissions, ROLE_PERMISSIONS } from './middleware';
import { users, workspaces } from '../db/schema';
import type { DB } from '../db/client';

// Token fake: "sub|email|verified"
const fakeVerifier = {
  verify: async (token: string) => {
    if (token === 'bad') throw new Error('invalid');
    const [sub, email, verified = 'true'] = token.split('|');
    return { sub, email, email_verified: verified === 'true', name: 'Fulano' };
  },
};

function buildApp(db: DB) {
  const app = express();
  app.use(authMiddleware({ db, verifier: fakeVerifier, bootstrapAdmins: ['boss@x.com'] }));
  app.get('/me', (req, res) => res.json({ ...req.user, activeWorkspace: req.workspaceId }));
  app.get('/inv', requirePermission('canManageInventory'), (_req, res) => res.json({ ok: true }));
  app.get('/read', requirePermission(), (_req, res) => res.json({ ok: true }));
  app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));
  return app;
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('authMiddleware', () => {
  let db: DB;
  beforeEach(async () => { db = await createTestDb(); });

  it('401 sem token', async () => {
    const res = await request(buildApp(db)).get('/me').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('401 com token inválido', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('bad')).expect(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('primeiro acesso cria uma oficina própria com o usuário como admin', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s1|a@x.com')).expect(200);
    expect(res.body).toMatchObject({ id: 's1', email: 'a@x.com', role: 'admin', status: 'approved', isSuperAdmin: false });
    expect(res.body.workspaceId).not.toBe('default');
    expect(res.body.activeWorkspace).toBe(res.body.workspaceId);
    const [w] = await db.select().from(workspaces).where(eq(workspaces.id, res.body.workspaceId));
    expect(w.name).toBe('Oficina de Fulano');
  });

  it('cadastros diferentes caem em oficinas diferentes', async () => {
    const app = buildApp(db);
    const a = await request(app).get('/me').set(auth('s1|a@x.com')).expect(200);
    const b = await request(app).get('/me').set(auth('s2|b@x.com')).expect(200);
    expect(a.body.workspaceId).not.toBe(b.body.workspaceId);
  });

  it('segundo acesso reaproveita o mesmo usuário', async () => {
    const app = buildApp(db);
    await request(app).get('/me').set(auth('s1|a@x.com'));
    await request(app).get('/me').set(auth('s1|a@x.com')).expect(200);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('e-mail de bootstrap vira admin geral (case-insensitive)', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s2|BOSS@x.com')).expect(200);
    expect(res.body).toMatchObject({ email: 'boss@x.com', role: 'admin', status: 'approved', isSuperAdmin: true });
  });

  it('admin geral troca de oficina pelo header; os demais não', async () => {
    await db.insert(workspaces).values({ id: 'w2', name: 'Outra' });
    const app = buildApp(db);
    const boss = await request(app).get('/me').set(auth('s2|boss@x.com')).set('X-Workspace-Id', 'w2').expect(200);
    expect(boss.body.activeWorkspace).toBe('w2');
    const other = await request(app).get('/me').set(auth('s1|a@x.com')).set('X-Workspace-Id', 'w2').expect(200);
    expect(other.body.activeWorkspace).toBe(other.body.workspaceId);
    const missing = await request(app).get('/me').set(auth('s2|boss@x.com')).set('X-Workspace-Id', 'nao-existe').expect(404);
    expect(missing.body.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('admin geral exige e-mail verificado', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s2|boss@x.com|false')).expect(200);
    expect(res.body.isSuperAdmin).toBe(false);
  });

  it('substring do e-mail não dá admin geral (regra antiga "murillo")', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s9|boss@x.com.evil')).expect(200);
    expect(res.body.isSuperAdmin).toBe(false);
  });

  it('acha usuário existente pelo e-mail verificado sem trocar o id interno', async () => {
    await db.insert(users).values({ id: 'firebase-uid', workspaceId: 'default', email: 'c@x.com', name: 'C', role: 'editor', status: 'approved' });
    const res = await request(buildApp(db)).get('/me').set(auth('s3|C@x.com')).expect(200);
    expect(res.body).toMatchObject({ id: 'firebase-uid', role: 'editor', status: 'approved' });
  });

  it('senha e Google (subs diferentes, mesmo e-mail) caem no mesmo usuário', async () => {
    const app = buildApp(db);
    const first = await request(app).get('/me').set(auth('cognito-sub|boss@x.com')).expect(200);
    const viaGoogle = await request(app).get('/me').set(auth('google-sub|boss@x.com')).expect(200);
    const again = await request(app).get('/me').set(auth('cognito-sub|boss@x.com')).expect(200);
    expect(viaGoogle.body.id).toBe(first.body.id);
    expect(again.body.id).toBe(first.body.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('não vincula por e-mail não verificado', async () => {
    await db.insert(users).values({ id: 'firebase-uid', workspaceId: 'default', email: 'c@x.com', name: 'C', role: 'admin', status: 'approved' });
    const res = await request(buildApp(db)).get('/me').set(auth('s4|c@x.com|false')).expect(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('requirePermission / requireAdmin', () => {
  let db: DB;
  let app: express.Express;
  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db);
    await db.insert(users).values([
      { id: 'v', workspaceId: 'default', email: 'v@x.com', name: 'V', role: 'viewer', status: 'approved' },
      { id: 'e', workspaceId: 'default', email: 'e@x.com', name: 'E', role: 'editor', status: 'approved' },
      { id: 'p', workspaceId: 'default', email: 'p@x.com', name: 'P', role: 'editor', status: 'pending' },
      { id: 'a', workspaceId: 'default', email: 'a@x.com', name: 'A', role: 'admin', status: 'pending' },
      { id: 'c', workspaceId: 'default', email: 'c@x.com', name: 'C', role: 'viewer', status: 'approved',
        permissions: { ...ROLE_PERMISSIONS.viewer, canManageInventory: true } },
    ]);
  });

  it('viewer aprovado lê mas não gerencia estoque', async () => {
    await request(app).get('/read').set(auth('v|v@x.com')).expect(200);
    const res = await request(app).get('/inv').set(auth('v|v@x.com')).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('editor aprovado gerencia estoque', async () => {
    await request(app).get('/inv').set(auth('e|e@x.com')).expect(200);
  });

  it('pendente é bloqueado mesmo para leitura', async () => {
    const res = await request(app).get('/read').set(auth('p|p@x.com')).expect(403);
    expect(res.body.code).toBe('NOT_APPROVED');
  });

  it('admin passa mesmo pendente', async () => {
    await request(app).get('/inv').set(auth('a|a@x.com')).expect(200);
    await request(app).get('/admin').set(auth('a|a@x.com')).expect(200);
  });

  it('permissão customizada sobrepõe preset do cargo', async () => {
    await request(app).get('/inv').set(auth('c|c@x.com')).expect(200);
  });

  it('não-admin bloqueado em rota admin', async () => {
    await request(app).get('/admin').set(auth('e|e@x.com')).expect(403);
  });

  it('effectivePermissions: admin sempre tem tudo', () => {
    expect(effectivePermissions({ role: 'admin', permissions: ROLE_PERMISSIONS.viewer } as any)).toEqual(ROLE_PERMISSIONS.admin);
  });
});
