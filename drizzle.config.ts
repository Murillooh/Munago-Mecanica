import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // mecanica_app só tem CREATE no schema public (não pode criar o schema "drizzle" padrão).
  migrations: { schema: 'public', table: '__drizzle_migrations' },
});
