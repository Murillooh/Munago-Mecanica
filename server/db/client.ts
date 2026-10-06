import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;

// CA pública da AWS para RDS (https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem).
const RDS_CA_PATH = fileURLToPath(new URL('./certs/rds-global-bundle.pem', import.meta.url));

/**
 * Com `sslmode` na URL, o pg passa a mandar no SSL e ignora o objeto `ssl`.
 * Por isso removemos o parâmetro e verificamos o certificado com a CA da AWS.
 */
export function poolConfig(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const wantsSsl = ['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode') ?? '');
  parsed.searchParams.delete('sslmode');
  return {
    connectionString: parsed.toString(),
    max: 10,
    ssl: wantsSsl ? { ca: readFileSync(RDS_CA_PATH, 'utf8'), rejectUnauthorized: true } : undefined,
  };
}

export function createDb(url = process.env.DATABASE_URL): DB & { $client: pg.Pool } {
  if (!url) throw new Error('DATABASE_URL não definida');
  return drizzle(new pg.Pool(poolConfig(url)), { schema });
}
