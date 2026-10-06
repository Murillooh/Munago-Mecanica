import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestDb } from '../test/testDb';
import { authMiddleware, requirePermission, requireAdmin, effectivePermissions, ROLE_PERMISSIONS } from './middleware';
import { users } from '../db/schema';
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
  app.get('/me', (req, res) => res.json(req.user));
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

  it('cria usuário viewer pendente no primeiro acesso', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s1|a@x.com')).expect(200);
    expect(res.body).toMatchObject({ id: 's1', email: 'a@x.com', role: 'viewer', status: 'pending' });
  });

  it('segundo acesso reaproveita o mesmo usuário', async () => {
    const app = buildApp(db);
    await request(app).get('/me').set(auth('s1|a@x.com'));
    await request(app).get('/me').set(auth('s1|a@x.com')).expect(200);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it('e-mail de bootstrap vira admin aprovado (case-insensitive)', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s2|BOSS@x.com')).expect(200);
    expect(res.body).toMatchObject({ email: 'boss@x.com', role: 'admin', status: 'approved' });
  });

  it('bootstrap exige e-mail verificado', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s2|boss@x.com|false')).expect(200);
    expect(res.body).toMatchObject({ role: 'viewer', status: 'pending' });
  });

  it('substring do e-mail não dá admin (regra antiga "murillo")', async () => {
    const res = await request(buildApp(db)).get('/me').set(auth('s9|boss@x.com.evil')).expect(200);
    expect(res.body.role).toBe('viewer');
  });

  it('acha usuário existente pelo e-mail verificado sem trocar o id interno', async () => {
    await db.insert(users).values({ id: 'firebase-uid', email: 'c@x.com', name: 'C', role: 'editor', status: 'approved' });
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
    await db.insert(users).values({ id: 'firebase-uid', email: 'c@x.com', name: 'C', role: 'admin', status: 'approved' });
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
      { id: 'v', email: 'v@x.com', name: 'V', role: 'viewer', status: 'approved' },
      { id: 'e', email: 'e@x.com', name: 'E', role: 'editor', status: 'approved' },
      { id: 'p', email: 'p@x.com', name: 'P', role: 'editor', status: 'pending' },
      { id: 'a', email: 'a@x.com', name: 'A', role: 'admin', status: 'pending' },
      { id: 'c', email: 'c@x.com', name: 'C', role: 'viewer', status: 'approved',
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
