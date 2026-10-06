import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;

export function createDb(url = process.env.DATABASE_URL): DB & { $client: pg.Pool } {
  if (!url) throw new Error('DATABASE_URL não definida');
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    // Aceita o certificado do RDS sem embutir o bundle da AWS. Endurecer depois com ssl.ca = global-bundle.pem.
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  return drizzle(pool, { schema });
}
