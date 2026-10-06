import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../db/schema';
import type { DB } from '../db/client';

/** Postgres em memória com as migrações reais aplicadas. */
export async function createTestDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'server/db/migrations' });
  return db as unknown as DB;
}
