/**
 * Aplica as migrações de server/db/migrations no DATABASE_URL.
 * Uso: npx tsx scripts/db/migrate.ts
 * (drizzle-kit migrate esconde o erro real; este script mostra.)
 */
import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../../server/db/client';

async function main() {
  const db = createDb();
  await migrate(db, {
    migrationsFolder: 'server/db/migrations',
    // mecanica_app só tem CREATE no schema public (não pode criar o schema "drizzle" padrão).
    migrationsSchema: 'public',
    migrationsTable: '__drizzle_migrations',
  });
  console.log('Migrações aplicadas.');
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
