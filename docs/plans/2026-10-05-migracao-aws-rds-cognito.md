# Migração Firebase → AWS (RDS PostgreSQL + Cognito) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Antes de cada task, invocar as skills do projeto citadas nela (regra do `CLAUDE.md`).

**Goal:** Tirar banco (Firestore) e login (Firebase Auth) do Firebase e rodar em AWS RDS PostgreSQL + Amazon Cognito, migrando dados e usuários existentes, sem perder funcionalidade.

**Architecture:** Hoje o navegador fala direto com o Firestore e a segurança mora em `firestore.rules`. Depois da migração, o navegador só fala com o Express (`server.ts`) via REST `/api/*`, autenticado por JWT do Cognito. O Express valida token, aplica permissões (o que antes era `firestore.rules`) e acessa o Postgres via Drizzle ORM. Tempo real (`onSnapshot`) vira Server-Sent Events: após cada escrita o servidor emite `changed:<recurso>` e o front refaz o fetch.

**Tech Stack:** PostgreSQL 16 (RDS), Drizzle ORM + drizzle-kit, `pg`, Amazon Cognito User Pool, `aws-jwt-verify` (server), `aws-amplify` v6 só módulo `auth` (client), `@aws-sdk/client-cognito-identity-provider` (server admin), Vitest + Supertest + PGlite (testes).

---

## Decisões já tomadas

| Item | Decisão |
|---|---|
| Banco | RDS PostgreSQL |
| Login | Cognito (sai Firebase Auth) |
| Dados existentes | Migrar do Firestore |
| Conta Google | `admin@exemplo.com` |

## Decisões de design (desta proposta — revisar)

1. **IDs:** colunas `id text` mantendo os IDs do Firestore. Migração preserva referências (`transactions.productId`, OS, etc.) sem tabela de-para. Novos registros usam `crypto.randomUUID()`.
2. **Itens da OS:** `service_orders.items jsonb`. Mantém shape atual da UI. Relatórios de peças continuam saindo de `transactions`.
3. **Estoque atômico:** movimentação e criação de OS rodam em transação SQL com `SELECT ... FOR UPDATE`. Corrige corrida que existe hoje (cliente lia estoque local e depois fazia `increment`).
4. **Notificação de estoque baixo:** gerada no servidor, dentro da mesma transação.
5. **Usuários:** tabela `users.id` = `sub` do Cognito. Senhas do Firebase **não** podem ser importadas (hash scrypt do Firebase não é aceito pelo Cognito). Cada usuário migrado recebe e-mail do Cognito com senha temporária e troca no primeiro login.
6. **Admins bootstrap:** e-mails hoje fixos no código (`admin-antigo@exemplo.com`, `admin-antigo@exemplo.com`, regex por nome/domínio nas rules) deixam de valer. `BOOTSTRAP_ADMIN_EMAILS` = `admin@exemplo.com` (único admin geral). Regex por substring some (era brecha: qualquer e-mail contendo "murillo" virava admin).
7. **Google Drive backup:** hoje usa token do popup Google do Firebase. Passa a usar o OAuth Google que já existe em `server.ts` (`/api/auth/google/url`). Login com Google via Cognito (IdP federado) fica fora deste plano — pode entrar depois.
8. **Região AWS:** `sa-east-1` (São Paulo).

## Pré-requisitos do usuário (bloqueiam Fase 1 e Fase 8)

- [ ] Conta AWS com billing ativo. Custo estimado: RDS `db.t4g.micro` + 20 GB gp3 ≈ US$ 15–20/mês fora do free tier; Cognito grátis até 10k usuários ativos/mês.
- [ ] Usuário IAM com acesso programático (políticas: `AmazonRDSFullAccess`, `AmazonCognitoPowerUser`, `AmazonEC2FullAccess` para security group) — **não** usar root.
- [ ] Instalar AWS CLI v2 e rodar `aws configure` (region `sa-east-1`).
- [ ] Acesso ao projeto Firebase `gen-lang-client-0706192241`: rodar `firebase login --reauth` com a conta dona do projeto e baixar chave de service account (Console Firebase → Configurações → Contas de serviço → Gerar chave). Salvar fora do repo.

---

## Fase 0 — Preparação

### Task 0.1: Versionar projeto

Projeto não é repositório git. Sem isso não há rollback.

**Step 1:** Garantir que `.gitignore` contém:

```
node_modules
dist
.env
.env.local
*.service-account*.json
project.zip
```

**Step 2:**

```bash
git init
git add -A
git commit -m "chore: snapshot before AWS migration"
```

**Step 3:** Criar branch:

```bash
git checkout -b feat/aws-migration
```

### Task 0.2: Ferramentas de teste

Skills: `javascript-testing-patterns`, `test-driven-development`.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1:**

```bash
npm i -D vitest supertest @types/supertest @electric-sql/pglite
```

**Step 2:** `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    pool: 'forks',
  },
});
```

**Step 3:** Em `package.json` → `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

**Step 4:** `npm test` → Expected: `No test files found` (exit 1 é ok nesta etapa).

**Step 5:** Commit `chore: add vitest`.

---

## Fase 1 — Infraestrutura AWS

Skills: `deployment-engineer`, `api-security-best-practices`. Pode ser feito pelo console AWS; abaixo os comandos CLI equivalentes.

### Task 1.1: Security group do RDS

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG_ID=$(aws ec2 create-security-group --group-name mecanica-rds --description "RDS Projeto Mecanica" --vpc-id $VPC_ID --query GroupId --output text)
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5432 --cidr $MY_IP/32
echo $SG_ID
```

Só seu IP acessa a porta 5432. Quando o servidor for para produção, liberar o IP/SG dele e remover o seu.

### Task 1.2: Instância RDS

```bash
aws rds create-db-instance \
  --db-instance-identifier mecanica-db \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-type gp3 \
  --master-username mecanica_admin \
  --manage-master-user-password \
  --db-name mecanica \
  --vpc-security-group-ids $SG_ID \
  --publicly-accessible \
  --backup-retention-period 7 \
  --storage-encrypted \
  --deletion-protection
aws rds wait db-instance-available --db-instance-identifier mecanica-db
aws rds describe-db-instances --db-instance-identifier mecanica-db --query 'DBInstances[0].[Endpoint.Address,MasterUserSecret.SecretArn]'
```

`--manage-master-user-password` guarda a senha no Secrets Manager. Ler:

```bash
aws secretsmanager get-secret-value --secret-id <SecretArn> --query SecretString --output text
```

### Task 1.3: Usuário de aplicação no Postgres

Não usar o master no app. Conectar com master (via `npx pg` ou cliente GUI como DBeaver/TablePlus) e rodar:

```sql
CREATE ROLE mecanica_app LOGIN PASSWORD '<senha-forte-gerada>';
GRANT CONNECT ON DATABASE mecanica TO mecanica_app;
GRANT USAGE, CREATE ON SCHEMA public TO mecanica_app;
```

### Task 1.4: Cognito User Pool

```bash
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name mecanica-users \
  --username-attributes email \
  --auto-verified-attributes email \
  --policies 'PasswordPolicy={MinimumLength=8,RequireUppercase=false,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false,TemporaryPasswordValidityDays=7}' \
  --admin-create-user-config 'AllowAdminCreateUserOnly=true' \
  --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
  --schema Name=name,AttributeDataType=String,Mutable=true \
  --query UserPool.Id --output text)

CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $POOL_ID \
  --client-name mecanica-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --query UserPoolClient.ClientId --output text)
echo $POOL_ID $CLIENT_ID
```

`AllowAdminCreateUserOnly=true`: ninguém se cadastra sozinho. Fluxo "solicitar acesso" (tabela `access_requests`) continua sendo o caminho público; admin aprova e o servidor cria o usuário no Cognito.

Opcional: personalizar e-mail de convite em `--admin-create-user-config InviteMessageTemplate=...` (português).

### Task 1.5: Variáveis de ambiente

**Files:**
- Modify: `.env.example`
- Create: `.env` (não versionado)

Adicionar a `.env.example`:

```
# PostgreSQL (RDS)
DATABASE_URL="postgres://mecanica_app:SENHA@HOST.sa-east-1.rds.amazonaws.com:5432/mecanica?sslmode=require"

# Cognito
AWS_REGION="sa-east-1"
COGNITO_USER_POOL_ID="sa-east-1_XXXXXXX"
COGNITO_CLIENT_ID="xxxxxxxxxxxxxxxxxxxx"
VITE_COGNITO_USER_POOL_ID="sa-east-1_XXXXXXX"
VITE_COGNITO_CLIENT_ID="xxxxxxxxxxxxxxxxxxxx"

# E-mails com admin automático no primeiro login (vírgula)
BOOTSTRAP_ADMIN_EMAILS="admin@exemplo.com"
```

Server precisa de credenciais AWS para chamadas admin do Cognito: em dev, vêm do `aws configure`; em produção, role IAM da máquina.

---

## Fase 2 — Schema do banco

Skills: `typescript-expert`, `nodejs-backend-patterns`.

### Task 2.1: Dependências

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

### Task 2.2: Schema Drizzle

**Files:**
- Create: `server/db/schema.ts`

```ts
import {
  pgTable, text, integer, numeric, boolean, timestamp, jsonb, index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'approved', 'denied']);
export const productStatusEnum = pgEnum('product_status', ['ativo', 'inativo']);
export const txTypeEnum = pgEnum('tx_type', ['in', 'out']);
export const osStatusEnum = pgEnum('os_status', ['draft', 'in_progress', 'completed', 'paid']);
export const accessReqStatusEnum = pgEnum('access_req_status', ['pending', 'approved', 'rejected']);

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export type Permissions = {
  canManageInventory: boolean;
  canManageOS: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canPerformTransactions: boolean;
};

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Cognito sub
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('viewer'),
  status: userStatusEnum('status').notNull().default('pending'),
  permissions: jsonb('permissions').$type<Permissions>(),
  photoUrl: text('photo_url'),
  legacyFirebaseUid: text('legacy_firebase_uid'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('users_email_uq').on(t.email)]);

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  aiSuggestion: text('ai_suggestion'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('categories_name_uq').on(t.name)]);

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // nome da categoria (igual hoje)
  price: money('price'),
  laborCost: money('labor_cost'),
  quantity: integer('quantity').notNull().default(0),
  minQuantity: integer('min_quantity').notNull().default(0),
  status: productStatusEnum('status').notNull().default('ativo'),
  imageUrl: text('image_url'),
  observation: text('observation'),
  expirationDate: text('expiration_date'),
  batch: text('batch'),
  supplier: text('supplier'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('products_name_idx').on(t.name), index('products_category_idx').on(t.category)]);

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(), // sem FK: histórico sobrevive à exclusão do produto (igual hoje)
  productName: text('product_name').notNull(),
  type: txTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason'),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('tx_timestamp_idx').on(t.timestamp), index('tx_product_idx').on(t.productId)]);

export type ServiceOrderItem = {
  productId: string; name: string; quantity: number; price: number;
  laborCost: number; total: number; observation?: string;
};

export const serviceOrders = pgTable('service_orders', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  vehicleModel: text('vehicle_model'),
  vehiclePlate: text('vehicle_plate'),
  items: jsonb('items').$type<ServiceOrderItem[]>().notNull().default([]),
  generalLaborCost: money('general_labor_cost').notNull().default(0),
  totalLaborCost: money('total_labor_cost').notNull().default(0),
  totalPartsCost: money('total_parts_cost').notNull().default(0),
  totalAmount: money('total_amount').notNull().default(0),
  status: osStatusEnum('status').notNull().default('draft'),
  scheduledDate: text('scheduled_date').notNull(),
  completionDate: text('completion_date'),
  observations: text('observations'),
  createdBy: text('created_by').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('os_created_idx').on(t.createdAt)]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  productId: text('product_id'),
  type: text('type').notNull().default('low_stock'),
  read: boolean('read').notNull().default(false),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notif_unread_idx').on(t.productId, t.read, t.type)]);

export const settings = pgTable('settings', {
  id: text('id').primaryKey(), // 'global'
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
});

export const accessRequests = pgTable('access_requests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  workshopName: text('workshop_name').notNull(),
  phone: text('phone'),
  message: text('message'),
  status: accessReqStatusEnum('status').notNull().default('pending'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

export const aiSearches = pgTable('ai_searches', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  query: text('query').notNull(),
  response: text('response').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ai_user_idx').on(t.userId, t.timestamp)]);

export const backups = pgTable('backups', {
  id: text('id').primaryKey(),
  productCount: integer('product_count').notNull(),
  transactionCount: integer('transaction_count').notNull(),
  categoryCount: integer('category_count').notNull(),
  serviceOrderCount: integer('service_order_count').notNull(),
  data: jsonb('data').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});
```

Nota: `money(...)` com `mode: 'number'` devolve `number` no JS (precisão de 2 casas basta para valores de oficina).

### Task 2.3: Conexão + config do drizzle-kit

**Files:**
- Create: `server/db/client.ts`
- Create: `drizzle.config.ts`

`server/db/client.ts`:

```ts
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;

export function createDb(url = process.env.DATABASE_URL): DB {
  if (!url) throw new Error('DATABASE_URL não definida');
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  return drizzle(pool, { schema });
}
```

(`rejectUnauthorized: false` aceita o certificado da AWS sem embutir o bundle. Para endurecer depois: baixar `global-bundle.pem` da AWS e passar em `ssl.ca`.)

`drizzle.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Scripts em `package.json`: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:studio": "drizzle-kit studio"`.

### Task 2.4: Gerar e aplicar migração

```bash
npm run db:generate   # Expected: cria server/db/migrations/0000_*.sql
npm run db:migrate    # Expected: aplica no RDS sem erro
```

Verificar: `npm run db:studio` mostra as 11 tabelas vazias.

### Task 2.5: Helper de banco para testes

**Files:**
- Create: `server/test/testDb.ts`

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../db/schema';
import type { DB } from '../db/client';

export async function createTestDb(): Promise<DB> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: 'server/db/migrations' });
  return db as unknown as DB;
}
```

Commit `feat(db): postgres schema and migrations`.

---

## Fase 3 — Autenticação no servidor

Skills: `auth-implementation-patterns`, `api-security-best-practices`, `backend-security-coder`.

### Task 3.1: Middleware de auth (TDD)

**Files:**
- Create: `server/auth/middleware.ts`
- Test: `server/auth/middleware.test.ts`

Design: middleware recebe um `verifier` injetável (em teste, fake; em produção, `CognitoJwtVerifier`). Após validar token, carrega/cria perfil em `users` e coloca em `req.user`.

**Step 1: teste que falha**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestDb } from '../test/testDb';
import { authMiddleware } from './middleware';
import { users } from '../db/schema';
import type { DB } from '../db/client';

const fakeVerifier = {
  verify: async (token: string) => {
    if (token === 'bad') throw new Error('invalid');
    const [sub, email] = token.split('|');
    return { sub, email, name: 'Fulano' } as any;
  },
};

function app(db: DB) {
  const a = express();
  a.use(authMiddleware({ db, verifier: fakeVerifier, bootstrapAdmins: ['boss@x.com'] }));
  a.get('/me', (req: any, res) => res.json(req.user));
  return a;
}

describe('authMiddleware', () => {
  let db: DB;
  beforeEach(async () => { db = await createTestDb(); });

  it('401 sem token', async () => {
    await request(app(db)).get('/me').expect(401);
  });

  it('401 token inválido', async () => {
    await request(app(db)).get('/me').set('Authorization', 'Bearer bad').expect(401);
  });

  it('cria usuário pendente no primeiro acesso', async () => {
    const res = await request(app(db)).get('/me').set('Authorization', 'Bearer s1|a@x.com').expect(200);
    expect(res.body).toMatchObject({ id: 's1', email: 'a@x.com', role: 'viewer', status: 'pending' });
  });

  it('bootstrap admin vira admin aprovado', async () => {
    const res = await request(app(db)).get('/me').set('Authorization', 'Bearer s2|BOSS@x.com').expect(200);
    expect(res.body).toMatchObject({ role: 'admin', status: 'approved' });
  });

  it('vincula usuário pré-cadastrado pelo e-mail (migrado)', async () => {
    await db.insert(users).values({ id: 'legacy-1', email: 'c@x.com', name: 'C', role: 'editor', status: 'approved' });
    const res = await request(app(db)).get('/me').set('Authorization', 'Bearer s3|c@x.com').expect(200);
    expect(res.body).toMatchObject({ id: 's3', role: 'editor', status: 'approved' });
  });
});
```

**Step 2:** `npx vitest run server/auth` → FAIL (`Cannot find module './middleware'`).

**Step 3: implementação**

```ts
import type { RequestHandler } from 'express';
import { eq, sql } from 'drizzle-orm';
import { users, type Permissions } from '../db/schema';
import type { DB } from '../db/client';

export type Role = 'admin' | 'editor' | 'viewer';
export type AuthUser = typeof users.$inferSelect;

export const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  admin:  { canManageInventory: true,  canPerformTransactions: true,  canManageOS: true,  canViewReports: true, canManageUsers: true },
  editor: { canManageInventory: true,  canPerformTransactions: true,  canManageOS: true,  canViewReports: true, canManageUsers: false },
  viewer: { canManageInventory: false, canPerformTransactions: false, canManageOS: false, canViewReports: true, canManageUsers: false },
};

type Verifier = { verify(token: string): Promise<{ sub: string; email?: unknown; name?: unknown }> };

export function authMiddleware(opts: { db: DB; verifier: Verifier; bootstrapAdmins: string[] }): RequestHandler {
  const admins = opts.bootstrapAdmins.map((e) => e.trim().toLowerCase()).filter(Boolean);

  return async (req: any, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    let claims;
    try {
      claims = await opts.verifier.verify(token);
    } catch {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    const email = String(claims.email ?? '').toLowerCase();
    const name = String(claims.name ?? '') || 'Usuário';

    try {
      req.user = await opts.db.transaction(async (tx) => {
        const [bySub] = await tx.select().from(users).where(eq(users.id, claims.sub));
        if (bySub) return bySub;

        // Usuário migrado/pré-cadastrado: mesmo e-mail, id antigo → assume o sub do Cognito
        const [byEmail] = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`);
        if (byEmail) {
          const [linked] = await tx.update(users)
            .set({ id: claims.sub, legacyFirebaseUid: byEmail.legacyFirebaseUid ?? byEmail.id })
            .where(eq(users.id, byEmail.id)).returning();
          return linked;
        }

        const isBoot = admins.includes(email);
        const role: Role = isBoot ? 'admin' : 'viewer';
        const [created] = await tx.insert(users).values({
          id: claims.sub, email, name, role,
          status: isBoot ? 'approved' : 'pending',
          permissions: ROLE_PERMISSIONS[role],
        }).returning();
        return created;
      });
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function effectivePermissions(u: AuthUser): Permissions {
  if (u.role === 'admin') return ROLE_PERMISSIONS.admin;
  return u.permissions && Object.keys(u.permissions).length ? u.permissions : ROLE_PERMISSIONS[u.role];
}

/** Exige usuário aprovado e (opcional) uma permissão. Substitui firestore.rules. */
export function requirePermission(perm?: keyof Permissions): RequestHandler {
  return (req: any, res, next) => {
    const u: AuthUser | undefined = req.user;
    if (!u) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (u.role !== 'admin' && u.status !== 'approved') return res.status(403).json({ error: 'NOT_APPROVED' });
    if (perm && !effectivePermissions(u)[perm]) return res.status(403).json({ error: 'FORBIDDEN', permission: perm });
    next();
  };
}

export const requireAdmin: RequestHandler = (req: any, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'ADMIN_ONLY' });
```

Atenção ao vínculo por e-mail: se `transactions.userId` / `service_orders.createdBy` apontam para o UID antigo do Firebase, o script de migração (Fase 8) já grava o histórico com o UID antigo; `legacyFirebaseUid` permite mapear nomes na UI se precisar.

**Step 4:** `npx vitest run server/auth` → PASS (5 testes).

**Step 5:** Teste de `requirePermission`: viewer aprovado → 403 em `canManageInventory`; editor → 200; pendente → 403 `NOT_APPROVED`; admin pendente → 200. Implementado acima; só escrever testes e rodar.

**Step 6:** Commit `feat(auth): cognito jwt middleware and permission guards`.

### Task 3.2: Verificador Cognito real

**Files:**
- Create: `server/auth/cognito.ts`

```bash
npm i aws-jwt-verify @aws-sdk/client-cognito-identity-provider
```

```ts
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand, AdminDisableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export function createCognitoVerifier() {
  return CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
    clientId: process.env.COGNITO_CLIENT_ID!,
    tokenUse: 'id', // id token traz email e name
  });
}

const idp = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

/** Cria no Cognito; Cognito envia e-mail com senha temporária. Retorna sub. */
export async function cognitoCreateUser(email: string, name: string): Promise<string> {
  const out = await idp.send(new AdminCreateUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: name },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  }));
  const sub = out.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) throw new Error('Cognito não retornou sub');
  return sub;
}

export async function cognitoDisableUser(email: string) {
  await idp.send(new AdminDisableUserCommand({ UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: email }));
}

export async function cognitoDeleteUser(email: string) {
  await idp.send(new AdminDeleteUserCommand({ UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: email }));
}
```

Isso substitui `/api/users/create` + `/api/auth/set-password` + nodemailer + JWT próprio: Cognito cuida de convite, senha temporária e troca obrigatória. `src/pages/SetPassword.tsx` vira tela de "nova senha" do fluxo Cognito (Task 7.3).

---

## Fase 4 — API REST

Skills: `api-design-principles`, `nodejs-backend-patterns`, `zod-validation-expert`, `error-handling-patterns`.

Convenções para todas as rotas:
- Prefixo `/api/v1`. Respostas JSON em camelCase (Drizzle já mapeia).
- Validação de body com zod (já é dependência). Erro de validação → 400 `{ error: 'VALIDATION', issues }`.
- Erros via `ApiError` existente em `server/middleware/errorHandler.ts`.
- Após escrita bem-sucedida: `events.emit('<recurso>')` (Fase 5).
- Cada router é uma factory `createXRouter({ db, events })` → testável com PGlite.

### Task 4.1: Bus de eventos (stub para os routers)

**Files:**
- Create: `server/realtime/events.ts`

```ts
import { EventEmitter } from 'node:events';

export type Resource =
  | 'products' | 'categories' | 'transactions' | 'serviceOrders'
  | 'notifications' | 'users' | 'settings' | 'accessRequests';

export class ChangeBus extends EventEmitter {
  emitChange(...resources: Resource[]) {
    for (const r of resources) this.emit('change', r);
  }
}
```

### Task 4.2: Produtos (TDD)

**Files:**
- Create: `server/routes/products.ts`
- Test: `server/routes/products.test.ts`
- Create: `server/test/appForTest.ts` (monta express com `req.user` fake e router)

`server/test/appForTest.ts`:

```ts
import express, { Router } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import type { AuthUser } from '../auth/middleware';

export function appForTest(router: Router, user: Partial<AuthUser>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.user = { status: 'approved', permissions: null, ...user }; next(); });
  app.use('/api/v1', router);
  app.use(errorHandler);
  return app;
}
```

Testes mínimos:
- `GET /products` → lista ordenada por nome.
- `POST /products` como viewer → 403; como editor → 201 com `id`, `createdAt`.
- `POST` com `quantity: -1` → 400.
- `PATCH /products/:id` → atualiza e muda `updatedAt`.
- `PATCH` com `quantity` negativa e `allowNegativeStock=false` → 400.
- `POST /products/bulk` → insere N em uma transação.
- `PATCH /products/bulk` `{ ids, updates }` → atualiza N.
- `DELETE /products/:id` → 204.
- Toda escrita chama `bus.emitChange('products')` (spy).

Implementação (padrão a repetir nos outros recursos):

```ts
import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { products } from '../db/schema';
import type { DB } from '../db/client';
import { requirePermission } from '../auth/middleware';
import type { ChangeBus } from '../realtime/events';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { getSettings } from './settings';

const productInput = z.object({
  sku: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  price: z.number().nonnegative().optional(),
  laborCost: z.number().nonnegative().optional(),
  quantity: z.number().int(),
  minQuantity: z.number().int().nonnegative(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  imageUrl: z.string().max(2000).optional(),
  observation: z.string().max(2000).optional(),
  expirationDate: z.string().optional(),
  batch: z.string().max(100).optional(),
  supplier: z.string().max(200).optional(),
});

export function createProductsRouter({ db, bus }: { db: DB; bus: ChangeBus }) {
  const r = Router();

  async function assertStockAllowed(qty: number | undefined) {
    if (qty === undefined || qty >= 0) return;
    const s = await getSettings(db);
    if (!s.allowNegativeStock) throw new ApiError(400, 'NEGATIVE_STOCK', 'Estoque não pode ser negativo.');
  }

  r.get('/products', requirePermission(), asyncHandler(async (_req, res) => {
    res.json(await db.select().from(products).orderBy(asc(products.name)));
  }));

  r.post('/products', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const data = productInput.parse(req.body);
    await assertStockAllowed(data.quantity);
    const [row] = await db.insert(products).values({ id: crypto.randomUUID(), ...data }).returning();
    bus.emitChange('products');
    res.status(201).json(row);
  }));

  r.post('/products/bulk', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const list = z.array(productInput).max(1000).parse(req.body);
    const rows = await db.insert(products).values(list.map((p) => ({ id: crypto.randomUUID(), ...p }))).returning();
    bus.emitChange('products');
    res.status(201).json(rows);
  }));

  r.patch('/products/bulk', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const { ids, updates } = z.object({ ids: z.array(z.string()).min(1), updates: productInput.partial() }).parse(req.body);
    await assertStockAllowed(updates.quantity);
    await db.update(products).set({ ...updates, updatedAt: sql`now()` }).where(inArray(products.id, ids));
    bus.emitChange('products');
    res.status(204).end();
  }));

  r.patch('/products/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    const updates = productInput.partial().parse(req.body);
    await assertStockAllowed(updates.quantity);
    const [row] = await db.update(products).set({ ...updates, updatedAt: sql`now()` })
      .where(eq(products.id, req.params.id)).returning();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Produto não encontrado.');
    bus.emitChange('products');
    res.json(row);
  }));

  r.delete('/products/:id', requirePermission('canManageInventory'), asyncHandler(async (req, res) => {
    await db.delete(products).where(eq(products.id, req.params.id));
    bus.emitChange('products');
    res.status(204).end();
  }));

  return r;
}
```

Verificar que `ApiError`/`asyncHandler` existentes em `server/middleware/errorHandler.ts` têm essas assinaturas e que `errorHandler` converte `ZodError` em 400; se não converter, adicionar esse caso lá (com teste).

Commit `feat(api): products routes`.

### Task 4.3: Settings

**Files:** `server/routes/settings.ts` + teste.

- `getSettings(db)`: lê `settings` id `global`; se não existe, retorna defaults `{ storeName: 'Munago Estoque', allowNegativeStock: false, accentColor: '#2563eb', autoBackupEnabled: false, enableSoundAlerts: true, monitorAutoScrollEnabled: true, monitorScrollIntervalSeconds: 12 }` mesclados com `data`.
- `GET /settings` → qualquer usuário aprovado.
- `PATCH /settings` → **somente admin** (hoje rules permitem qualquer aprovado; endurecer). Upsert com merge: `data = settings.data || $patch::jsonb`.
- Emite `settings`.

Teste: viewer PATCH → 403; admin PATCH merge preserva chaves antigas.

### Task 4.4: Categorias

**Files:** `server/routes/categories.ts` + teste.

- CRUD com `canManageInventory` para escrita.
- `PATCH /categories/:id` com nome novo: **em uma transação SQL** atualiza a categoria e `UPDATE products SET category = $novo WHERE category = $antigo`. Emite `categories`, `products`.
- `DELETE`: se existe produto com aquela categoria → 409 `CATEGORY_IN_USE` com mensagem "Não é possível excluir uma categoria que possui produtos vinculados."

Testes: rename propaga para produtos; delete com produto vinculado → 409.

### Task 4.5: Movimentações de estoque (núcleo — TDD rigoroso)

**Files:** `server/services/stock.ts`, `server/routes/transactions.ts` + testes.

`server/services/stock.ts`:

```ts
import { and, eq, sql } from 'drizzle-orm';
import { notifications, products, transactions } from '../db/schema';
import type { DB } from '../db/client';
import { ApiError } from '../middleware/errorHandler';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export async function applyMovement(
  tx: Tx,
  m: { productId: string; type: 'in' | 'out'; quantity: number; reason?: string; userId: string; userName: string },
  allowNegative: boolean,
) {
  const [p] = await tx.select().from(products).where(eq(products.id, m.productId)).for('update');
  if (!p) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');

  const newQty = p.quantity + (m.type === 'in' ? m.quantity : -m.quantity);
  if (newQty < 0 && !allowNegative) {
    throw new ApiError(400, 'INSUFFICIENT_STOCK', `Estoque insuficiente para o item: ${p.name}`);
  }

  await tx.update(products).set({ quantity: newQty, updatedAt: sql`now()` }).where(eq(products.id, p.id));
  await tx.insert(transactions).values({
    id: crypto.randomUUID(), productId: p.id, productName: p.name, type: m.type,
    quantity: m.quantity, reason: m.reason, userId: m.userId, userName: m.userName,
  });

  let lowStock = false;
  if (newQty <= p.minQuantity) {
    lowStock = true;
    const [existing] = await tx.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.productId, p.id), eq(notifications.read, false), eq(notifications.type, 'low_stock'),
    ));
    if (!existing) {
      await tx.insert(notifications).values({
        id: crypto.randomUUID(), title: 'Alerta de Estoque Baixo',
        message: `O produto "${p.name}" atingiu o nível crítico (${newQty} unidades).`,
        productId: p.id, type: 'low_stock',
      });
    }
  }
  return { newQty, lowStock };
}
```

Rotas:
- `GET /transactions` → aprovado, ordenado `timestamp desc`. Aceitar `?limit=` (default 1000) para não puxar histórico infinito.
- `POST /transactions` `{ productId, type, quantity>0 int, reason? }` → `canPerformTransactions`. `userId`/`userName` vêm de `req.user` (nunca do body — hoje o cliente manda e poderia forjar). Roda `applyMovement` em `db.transaction`. Resposta `{ newQty, lowStock }` (front usa `lowStock` para tocar som). Emite `transactions`, `products`, e `notifications` se `lowStock`.
- Sem update/delete (imutável, igual hoje).

Testes:
1. entrada soma; saída subtrai.
2. saída maior que estoque com `allowNegativeStock=false` → 400 e **nada** gravado (nem transaction).
3. cruza mínimo → cria 1 notificação; segunda saída não duplica enquanto não lida.
4. viewer → 403.
5. concorrência: duas saídas simultâneas de 5 com estoque 8 → uma passa, outra 400; estoque final 3. (PGlite é single-connection; este teste roda só se `TEST_DATABASE_URL` apontar para Postgres real — marcar com `it.skipIf(!process.env.TEST_DATABASE_URL)`.)

### Task 4.6: Ordens de serviço

**Files:** `server/routes/serviceOrders.ts` + teste.

- `GET /service-orders` → aprovado, `created_at desc`.
- `POST /service-orders` → `canManageOS`. Zod espelhando `ServiceOrder` sem `id/createdAt/updatedAt/createdBy`. Em uma transação: insere OS (`createdBy = req.user.id`) e chama `applyMovement` para cada item com `type: 'out'`, `reason: 'Ordem de Serviço #' + id.slice(-6).toUpperCase()`. Falha em qualquer item → rollback total (hoje o batch do Firestore já era atômico, mas a checagem de estoque não). Emite `serviceOrders`, `products`, `transactions`, `notifications`.
- `PATCH /service-orders/:id` → `canManageOS`; não permite mudar `createdBy` nem `items` (mudar itens exigiria estornar estoque — fora de escopo, igual hoje a UI não faz). Se UI precisar, retornar 400 `ITEMS_IMMUTABLE`.
- `DELETE` → `canManageOS`. Comportamento atual: **não devolve estoque**. Manter e registrar como pendência para decidir.

Testes: OS com 2 itens baixa estoque dos 2 e cria 2 transactions; item sem estoque → 400 e nada gravado.

### Task 4.7: Notificações

- `GET /notifications` → `canManageInventory || canManageOS` (igual rules), `timestamp desc`.
- `PATCH /notifications/:id/read` → marca lida.
- `DELETE /notifications/:id`.

### Task 4.8: Usuários (admin)

**Files:** `server/routes/users.ts` + teste (Cognito mockado via injeção `{ createUser, deleteUser, disableUser }`).

- `GET /me` → `req.user` + `permissions: effectivePermissions(req.user)`. **Não** exige aprovado (tela de "aguardando aprovação" precisa ler status).
- `GET /users` → `canManageUsers`, ordenado por nome.
- `POST /users` `{ email, name, role, permissions? }` → `canManageUsers`. Chama `cognitoCreateUser` e insere `users` com `id = sub`, `status: 'approved'`. Se Cognito responder `UsernameExistsException` → 409. **Substitui** `/api/users/create` (que hoje é público — falha de segurança) e o "modo manual" que mostrava senha em toast e gravava `tempPassword` no Firestore.
- `PATCH /users/:id` `{ role?, permissions?, status? }` → `canManageUsers`. Ao mudar `role` sem `permissions`, aplica `ROLE_PERMISSIONS[role]`. Bloquear: usuário remover o próprio admin (evita ficar sem admin).
- `DELETE /users/:id` → `canManageUsers`; remove do banco e `cognitoDeleteUser(email)`. Bloquear auto-exclusão.
- Emite `users`.

### Task 4.9: Solicitações de acesso (pública)

- `POST /access-requests` **sem auth**, com `express-rate-limit` (ex.: 5/hora por IP) — substitui `addDoc` em `src/pages/Login.tsx:58`.
- `GET /access-requests?status=pending` → admin.
- `POST /access-requests/:id/approve` `{ role }` → admin: cria usuário via mesma lógica do `POST /users` e marca `approved`. Substitui o `setDoc` + `updateDoc` em `src/pages/Users.tsx:386-412`.
- `POST /access-requests/:id/reject` → admin.

### Task 4.10: Histórico IA e backups

- `GET /ai-searches` → só do próprio usuário (`user_id = req.user.id`), últimos 50.
- `POST /ai-searches` → grava com `userId = req.user.id`.
- `POST /backups` → admin; servidor monta o snapshot (não o cliente) e atualiza `settings.lastFirestoreBackup` → renomear chave para `lastBackup`.
- Melhor: mover backup automático diário para o servidor (`setInterval` 1h checando `lastBackup > 24h`). Remove o `useEffect` de backup do `AppContext`. Observação: RDS já tem backup automático de 7 dias (Task 1.2); esse backup lógico vira redundância — avaliar se mantém.

### Task 4.11: Montar no server.ts

**Files:** Modify `server.ts`.

- Adicionar ao `envSchema`: `DATABASE_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `AWS_REGION`, `BOOTSTRAP_ADMIN_EMAILS` (obrigatórios exceto o último).
- Criar `db`, `bus`, `verifier`.
- `app.use('/api/v1', authMiddleware(...))` **depois** da rota pública `/api/v1/access-requests` (POST) e antes das demais.
- Montar todos os routers.
- **Proteger rotas existentes** que hoje são abertas: `/api/gemini/*` (qualquer um gasta sua cota Gemini), `/api/sheets/data`, `/api/download-project` (expõe o código-fonte — avaliar remoção). Passam a exigir `authMiddleware` + `requirePermission()`.
- Remover `/api/users/create`, `/api/auth/set-password`, inicialização `firebase-admin`, `nodemailer` (se não usado em outro lugar), `JWT_SECRET`.

Teste de fumaça manual: `npm run dev`, `curl -i localhost:3000/api/v1/products` → 401.

Commit `feat(api): mount v1 routes, protect gemini/sheets`.

---

## Fase 5 — Tempo real (SSE)

Skills: `nodejs-backend-patterns`, `frontend-api-integration-patterns`.

### Task 5.1: Endpoint SSE

**Files:** `server/realtime/sse.ts` + teste.

```ts
import type { RequestHandler } from 'express';
import type { ChangeBus, Resource } from './events';

export function sseHandler(bus: ChangeBus): RequestHandler {
  return (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const onChange = (r: Resource) => res.write(`event: change\ndata: ${r}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    bus.on('change', onChange);
    req.on('close', () => { clearInterval(ping); bus.off('change', onChange); });
  };
}
```

`EventSource` não envia header `Authorization`. Solução: rota `GET /api/v1/events?token=<idToken>`; um middleware pequeno copia `req.query.token` para `req.headers.authorization` **só nessa rota** antes do `authMiddleware`. Exigir `requirePermission()`.

Limitação: o bus é em memória — funciona com **uma** instância do servidor. Se escalar para várias, trocar por `LISTEN/NOTIFY` do Postgres. Registrar no README.

Teste: conecta com supertest em stream, `bus.emitChange('products')`, recebe `data: products`.

---

## Fase 6 — Cliente: API e auth

Skills: `frontend-api-integration-patterns`, `react-patterns`, `react-state-management`, `typescript-expert`.

### Task 6.1: Amplify Auth

```bash
npm i aws-amplify
```

**Files:** Create `src/lib/auth.ts`

```ts
import { Amplify } from 'aws-amplify';
import {
  signIn, signOut, confirmSignIn, fetchAuthSession, resetPassword, confirmResetPassword, getCurrentUser,
} from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: { email: true },
    },
  },
});

export async function getIdToken(): Promise<string | null> {
  try {
    const s = await fetchAuthSession();
    return s.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Retorna 'DONE' ou 'NEW_PASSWORD_REQUIRED' (primeiro login com senha temporária). */
export async function login(email: string, password: string) {
  const r = await signIn({ username: email, password });
  if (r.isSignedIn) return 'DONE' as const;
  if (r.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return 'NEW_PASSWORD_REQUIRED' as const;
  throw new Error(`Etapa de login não suportada: ${r.nextStep.signInStep}`);
}

export const completeNewPassword = (newPassword: string) => confirmSignIn({ challengeResponse: newPassword });
export const requestPasswordReset = (email: string) => resetPassword({ username: email });
export const confirmPasswordReset = (email: string, code: string, newPassword: string) =>
  confirmResetPassword({ username: email, confirmationCode: code, newPassword });
export const logout = () => signOut();
export const currentUser = () => getCurrentUser().catch(() => null);
```

Atualizar `src/vite-env.d.ts` (criar se não existir) com tipos de `ImportMetaEnv` para as duas `VITE_*`.

### Task 6.2: Cliente HTTP

**Files:** Create `src/lib/api.ts`

```ts
import { getIdToken } from './auth';

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, body.error ?? 'HTTP_ERROR', body.message ?? `Erro ${res.status}`);
  return body as T;
}

export const get = <T>(p: string) => api<T>(p);
export const post = <T>(p: string, b?: unknown) => api<T>(p, { method: 'POST', body: JSON.stringify(b ?? {}) });
export const patch = <T>(p: string, b: unknown) => api<T>(p, { method: 'PATCH', body: JSON.stringify(b) });
export const del = (p: string) => api<void>(p, { method: 'DELETE' });

/** Assina /events; chama onChange(resource). Reconecta com token novo ao cair. */
export function subscribeChanges(onChange: (resource: string) => void): () => void {
  let es: EventSource | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout>;

  const connect = async () => {
    const token = await getIdToken();
    if (closed || !token) return;
    es = new EventSource(`/api/v1/events?token=${encodeURIComponent(token)}`);
    es.addEventListener('change', (e) => onChange((e as MessageEvent).data));
    es.onerror = () => { es?.close(); if (!closed) retry = setTimeout(connect, 3000); };
  };
  connect();
  return () => { closed = true; clearTimeout(retry); es?.close(); };
}
```

Token Cognito no query string do SSE: aceitável (HTTPS, id token de vida curta 1h), mas garantir que o logger `pino` **não** registre a URL com query dessa rota.

### Task 6.3: Reescrever AppContext

Skills: `react-state-management`, `react-best-practices`.

**Files:** Modify `src/context/AppContext.tsx` (1434 linhas).

Regra: **manter a interface `AppContextType` idêntica** para não tocar as 10+ páginas que usam `useApp()`. Mudam só internals. Exceções:
- `user: FirebaseUser | null` → `user: { id: string; email: string } | null`. Buscar usos de `user.uid`, `user.email`, `user.displayName`, `user.photoURL` nas páginas e trocar `uid` → `id` (grep `user\.uid|user\?\.uid`).
- `login()` (Google popup) → remover; Login só e-mail/senha.
- `registerEmail` → remover (cadastro é via solicitação de acesso).
- `loginEmail` passa a retornar `'DONE' | 'NEW_PASSWORD_REQUIRED'`.
- `driveToken` → vem do fluxo OAuth Google do servidor (já existe `src/hooks/useGoogleAuth.ts`; reaproveitar).

Estrutura nova:

```ts
// carregar tudo de uma vez após /me aprovado
const loaders = {
  products:      () => get<Product[]>('/products').then(setProducts),
  transactions:  () => get<Transaction[]>('/transactions').then(setTransactions),
  categories:    () => get<Category[]>('/categories').then(setCategories),
  serviceOrders: () => get<ServiceOrder[]>('/service-orders').then(setServiceOrders),
  settings:      () => get<SystemSettings>('/settings').then((s) => setSettings((p) => ({ ...p, ...s }))),
  notifications: () => canSeeNotifications ? get<Notification[]>('/notifications').then(setNotifications) : Promise.resolve(),
  users:         () => canManageUsers ? get<UserProfile[]>('/users').then(setAllUsers) : Promise.resolve(),
};

useEffect(() => {
  if (!profile || (profile.status !== 'approved' && profile.role !== 'admin')) return;
  Promise.all(Object.values(loaders).map((f) => f())).catch(handleApiError);
  return subscribeChanges((r) => loaders[r as keyof typeof loaders]?.().catch(handleApiError));
}, [profile?.id, profile?.status, profile?.role]);
```

Campos de data: API devolve ISO string. Páginas hoje tratam `createdAt`/`timestamp` como Firestore `Timestamp` (`.toDate()`, `.seconds`). **Antes de reescrever**, `grep -rn "toDate()\|\.seconds" src` e criar helper `toDate(v: string | Date): Date` em `src/lib/utils.ts`, trocando cada uso. Isso é a maior fonte de bugs da migração.

Ações viram chamadas simples, ex.:

```ts
const registerTransactionAction = async (productId: string, _pn: string, type: 'in' | 'out', quantity: number, reason: string) => {
  if (!canPerformTransactions) { toast.error('Acesso restrito: ...'); return; }
  try {
    const { lowStock } = await post<{ lowStock: boolean }>('/transactions', { productId, type, quantity, reason });
    if (lowStock) playLowStockAlertIfEnabled(settings.enableSoundAlerts);
  } catch (e) { handleApiError(e); }
};
```

(`userId`/`userName` continuam na assinatura para não quebrar chamadores, mas são ignorados — servidor usa o usuário autenticado.)

Remover: `isMainAdmin` por substring de e-mail (linhas 489, 578, 585), `console.log('User permissions debug')` (linha 712, vaza dados no console), backup automático no cliente (linhas 600-639), lógica de criação de perfil no cliente (linhas 397-484 → servidor já faz em `/me`), `handleRestoreFromDrive` escrevendo direto no banco → `POST /backups/restore` admin no servidor.

Permissões no cliente servem **só para esconder botões**; a autoridade é o servidor.

Verificação: `npm run lint` (tsc) sem erros.

### Task 6.4: Telas de auth

Skills: `ux-copy`, `fixing-accessibility`, `frontend-security-coder`.

**Files:**
- Modify: `src/pages/Login.tsx` — remover botão Google e cadastro; `loginEmail` → se `NEW_PASSWORD_REQUIRED`, trocar para formulário "Defina sua nova senha" (`completeNewPassword`). "Esqueci a senha" → `requestPasswordReset` + formulário código + nova senha (`confirmPasswordReset`). Solicitação de acesso → `post('/access-requests', ...)`.
- Modify: `src/pages/SetPassword.tsx` — vira o formulário de nova senha reutilizável (ou remover a rota `/auth/set-password` se o fluxo ficar todo dentro do Login).
- Modify: `src/pages/Users.tsx` — trocar `db`/`firestore` por `get/post/patch` nas rotas de access-requests e users.
- Modify: `src/components/AIAssistant.tsx` — `ai_searches` via API.
- Delete: `src/firebase.ts`.

Mensagens de erro Cognito em português: mapear `NotAuthorizedException` → "E-mail ou senha incorretos.", `UserNotFoundException` → mesma mensagem (não revelar existência), `LimitExceededException` → "Muitas tentativas. Aguarde alguns minutos.", `InvalidPasswordException` → "A senha precisa ter ao menos 8 caracteres, com letras minúsculas e números.", `CodeMismatchException` → "Código inválido.".

### Task 6.5: Verificação ponta a ponta

Skills: `verification-before-completion`, `webapp-testing`.

Com `.env` apontando para RDS + Cognito reais e banco vazio:

1. Criar seu usuário no Cognito: `aws cognito-idp admin-create-user --user-pool-id $POOL_ID --username admin@exemplo.com --user-attributes Name=email,Value=admin@exemplo.com Name=email_verified,Value=true Name=name,Value="Murillo"`.
2. Login com senha temporária → pede nova senha → entra como admin (bootstrap).
3. Criar categoria, produto (estoque 5, mínimo 2), entrada +3, saída -7 → notificação de estoque baixo aparece **sem recarregar** em outra aba (SSE).
4. Saída maior que estoque → toast de erro, estoque inalterado.
5. Criar OS com 2 itens → estoque baixa, 2 movimentações.
6. Criar usuário operador pela tela → e-mail do Cognito chega → login → não vê Usuários; tenta `PATCH /settings` via curl com token dele → 403.
7. Solicitação de acesso deslogado → admin aprova → e-mail chega.
8. Exportar PDF e Excel continuam funcionando (dados agora vêm da API).
9. Modo escuro, cor de destaque, modo monitor persistem (settings no Postgres).

---

## Fase 7 — Migração de dados

Skills: `firebase`, `systematic-debugging`.

### Task 7.1: Exportar Firestore

**Files:** Create `scripts/migrate/export-firestore.ts`

- Usa `firebase-admin` com service account (`GOOGLE_APPLICATION_CREDENTIALS=<caminho-fora-do-repo>`) e `firestoreDatabaseId` de `firebase-applet-config.json`.
- Para cada coleção (`users, products, categories, transactions, serviceOrders, notifications, settings, access_requests, ai_searches, backups`): grava `scripts/migrate/out/<colecao>.json` com `{ id, ...data }`, convertendo `Timestamp` → ISO string.
- Imprime contagem por coleção.

```bash
npx tsx scripts/migrate/export-firestore.ts
```

`scripts/migrate/out/` no `.gitignore` (contém dados pessoais de clientes).

### Task 7.2: Importar no Postgres (idempotente)

**Files:** Create `scripts/migrate/import-postgres.ts` + `scripts/migrate/import-postgres.test.ts`

- Lê os JSON, normaliza e insere com `onConflictDoNothing()` (rodar 2× não duplica).
- Normalizações:
  - `users`: ignorar docs cujo id é e-mail e `uid: ''` (pré-cadastros do "modo manual") **mas** importá-los como usuários se não houver doc com o mesmo e-mail; remover campos `tempPassword`, `passwordResetToken`, `passwordResetExpires`. `id` = UID Firebase (vai ser trocado pelo `sub` no primeiro login via vínculo por e-mail — Task 3.1). Status ausente → regra atual (`admin/editor` → approved, senão pending).
  - números ausentes (`price`, `laborCost`) → `null`; `quantity` string → `parseInt`.
  - `serviceOrders.items` sem `laborCost`/`total` → recalcular `total = quantity * price + laborCost`.
  - `settings/global` → linha `settings` id `global`; renomear `lastFirestoreBackup` → `lastBackup`.
  - datas inválidas → `now()` e logar o id.
- Ao final, imprimir contagem por tabela e comparar com export. Diferença → abortar com exit 1.

Teste com PGlite + JSON de fixture cobrindo cada normalização.

```bash
DATABASE_URL=... npx tsx scripts/migrate/import-postgres.ts
```

### Task 7.3: Criar usuários no Cognito

**Files:** Create `scripts/migrate/create-cognito-users.ts`

- Para cada linha em `users` com `status = 'approved'`: `AdminCreateUser` com `MessageAction: 'SUPPRESS'` (não manda e-mail ainda).
- Flag `--send-invites`: reenvia com `MessageAction: 'RESEND'` → Cognito manda e-mail com senha temporária. Rodar só no dia da virada.
- Usuários `pending/denied` não vão pro Cognito.
- Idempotente: `UsernameExistsException` → pula.

### Task 7.4: Conferência

Query de conferência (rodar no RDS):

```sql
SELECT 'products' t, count(*) FROM products UNION ALL
SELECT 'transactions', count(*) FROM transactions UNION ALL
SELECT 'service_orders', count(*) FROM service_orders UNION ALL
SELECT 'users', count(*) FROM users;

-- estoque atual deve bater com o Firestore produto a produto
SELECT id, name, quantity FROM products ORDER BY name;
```

Comparar 5 produtos e 3 OS aleatórios lado a lado com o console Firebase.

---

## Fase 8 — Limpeza

Skills: `clean-code`, `lint-and-validate`, `security-audit`.

### Task 8.1: Remover Firebase

```bash
npm uninstall firebase firebase-admin
```

Deletar: `src/firebase.ts`, `firestore.rules`, `firebase-blueprint.json`, `firebase-applet-config.json` (depois da migração de dados concluída e conferida — o script de export precisa dele), `server/middleware/validation.ts` se só servia `/api/users/create`.

`grep -rn "firebase" src server server.ts` → zero resultados (exceto `scripts/migrate/`).

### Task 8.2: Segredos

- `firebase-applet-config.json` contém API key Firebase versionada. Após desligar, restringir/deletar a key no Google Cloud Console.
- `JWT_SECRET` default hardcoded (`loc-estoque-default-secret-change-me`) — remover junto com o fluxo antigo.
- `.env` nunca versionado (checar `git log --all -- .env`).

### Task 8.3: Validação final

```bash
npm run lint   # Expected: 0 erros
npm test       # Expected: todos PASS
npm run build  # Expected: dist/ gerado
```

Repetir checklist da Task 6.5 contra os **dados migrados**.

Commit `chore: remove firebase`.

---

## Fase 9 — Virada (cutover)

1. Avisar usuários: janela de manutenção, receberão e-mail para nova senha.
2. Colocar app antigo em somente leitura (ou parar) para não entrar dado novo no Firestore.
3. Rodar Task 7.1 → 7.2 → 7.4 (export final, import, conferência).
4. Rodar `create-cognito-users.ts --send-invites`.
5. Subir nova versão.
6. Manter projeto Firebase intacto (somente leitura) por 30 dias como rollback. Rollback = voltar deploy anterior; dados criados após a virada ficam só no Postgres.
7. Após 30 dias: excluir banco Firestore e desativar projeto.

---

## Pendências para decidir (não bloqueiam início)

- Excluir OS deve devolver estoque? (hoje não devolve)
- Manter backup lógico diário no banco ou confiar só no backup automático do RDS (7 dias, point-in-time)?
- Login com Google via Cognito (IdP federado) — quer de volta?
- Onde o servidor Express vai rodar em produção (EC2, App Runner, Lightsail, Elastic Beanstalk)? Define security group final do RDS e credenciais IAM do Cognito.
