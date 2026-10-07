import express, { type Router } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { createTestDb } from './testDb';
import { createApiRouter } from '../api';
import { ChangeBus } from '../realtime/events';
import { errorHandler } from '../middleware/errorHandler';
import { users } from '../db/schema';
import type { DB } from '../db/client';
import type { CognitoAdmin } from '../auth/cognito';

// Token fake: "sub|email"
const fakeVerifier = {
  verify: async (token: string) => {
    const [sub, email] = token.split('|');
    if (!sub || !email) throw new Error('invalid');
    return { sub, email, email_verified: true, name: sub };
  },
};

export const TOKENS = {
  admin: 'admin|admin@x.com',
  editor: 'editor|editor@x.com',
  viewer: 'viewer|viewer@x.com',
  pending: 'pending|pending@x.com',
};

/** `extra` monta rotas autenticadas adicionais (ex.: Google), recebendo o banco de teste. */
export async function createHarness(extra?: (db: DB) => (r: Router) => void) {
  const db: DB = await createTestDb();
  const bus = new ChangeBus();
  const changes: string[] = [];
  bus.on('change', (r) => changes.push(r));

  let n = 0;
  const cognito: CognitoAdmin = {
    createUser: vi.fn(async () => `cognito-sub-${++n}`),
    disableUser: vi.fn(async () => {}),
    deleteUser: vi.fn(async () => {}),
  };

  await db.insert(users).values([
    { id: 'admin', email: 'admin@x.com', name: 'Admin', role: 'admin', status: 'approved' },
    { id: 'editor', email: 'editor@x.com', name: 'Editor', role: 'editor', status: 'approved' },
    { id: 'viewer', email: 'viewer@x.com', name: 'Viewer', role: 'viewer', status: 'approved' },
    { id: 'pending', email: 'pending@x.com', name: 'Pending', role: 'editor', status: 'pending' },
  ]);

  const app = express();
  app.use(express.json());
  app.use('/api/v1', createApiRouter({ db, bus, cognito, verifier: fakeVerifier, bootstrapAdmins: [], extra: extra?.(db) }));
  app.use(errorHandler);

  const as = (who: keyof typeof TOKENS) => {
    const auth = { Authorization: `Bearer ${TOKENS[who]}` };
    return {
      get: (p: string) => request(app).get(`/api/v1${p}`).set(auth),
      post: (p: string, b?: object) => request(app).post(`/api/v1${p}`).set(auth).send(b ?? {}),
      patch: (p: string, b: object) => request(app).patch(`/api/v1${p}`).set(auth).send(b),
      del: (p: string) => request(app).delete(`/api/v1${p}`).set(auth),
    };
  };

  return { app, db, bus, changes, cognito, as, anon: request(app) };
}
