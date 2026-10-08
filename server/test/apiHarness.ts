import express, { type Router } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { createTestDb } from './testDb';
import { createApiRouter } from '../api';
import { ChangeBus } from '../realtime/events';
import { errorHandler } from '../middleware/errorHandler';
import { users, workspaces } from '../db/schema';
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
  /** Admin de outra oficina: não pode ver nem mexer nos dados da 'default'. */
  outsider: 'outsider|outsider@y.com',
  /** Admin geral (BOOTSTRAP_ADMIN_EMAILS), mora na 'default'. */
  boss: 'boss|boss@x.com',
  /** Sem cadastro prévio: o primeiro acesso cai na fila de cadastros sem oficina. */
  newbie: 'newbie|newbie@z.com',
  newbie2: 'newbie2|newbie2@z.com',
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

  // A migração já cria a oficina 'default'.
  await db.insert(workspaces).values({ id: 'other', name: 'Outra Oficina' });
  await db.insert(users).values([
    { id: 'admin', workspaceId: 'default', email: 'admin@x.com', name: 'Admin', role: 'admin', status: 'approved' },
    { id: 'editor', workspaceId: 'default', email: 'editor@x.com', name: 'Editor', role: 'editor', status: 'approved' },
    { id: 'viewer', workspaceId: 'default', email: 'viewer@x.com', name: 'Viewer', role: 'viewer', status: 'approved' },
    { id: 'pending', workspaceId: 'default', email: 'pending@x.com', name: 'Pending', role: 'editor', status: 'pending' },
    { id: 'outsider', workspaceId: 'other', email: 'outsider@y.com', name: 'Outsider', role: 'admin', status: 'approved' },
    { id: 'boss', workspaceId: 'default', email: 'boss@x.com', name: 'Boss', role: 'admin', status: 'approved' },
  ]);

  const app = express();
  app.use(express.json());
  app.use('/api/v1', createApiRouter({ db, bus, cognito, verifier: fakeVerifier, bootstrapAdmins: ['boss@x.com'], extra: extra?.(db) }));
  app.use(errorHandler);

  /** `workspace`: oficina pedida via header (só vale para o admin geral). */
  const as = (who: keyof typeof TOKENS, workspace?: string) => {
    const auth: Record<string, string> = { Authorization: `Bearer ${TOKENS[who]}` };
    if (workspace) auth['X-Workspace-Id'] = workspace;
    return {
      get: (p: string) => request(app).get(`/api/v1${p}`).set(auth),
      post: (p: string, b?: object) => request(app).post(`/api/v1${p}`).set(auth).send(b ?? {}),
      patch: (p: string, b: object) => request(app).patch(`/api/v1${p}`).set(auth).send(b),
      del: (p: string) => request(app).delete(`/api/v1${p}`).set(auth),
    };
  };

  return { app, db, bus, changes, cognito, as, anon: request(app) };
}
