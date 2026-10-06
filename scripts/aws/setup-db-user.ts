/**
 * Cria o usuário de aplicação `mecanica_app` no RDS e grava DATABASE_URL no .env.
 * Lê a senha master do Secrets Manager (via AWS CLI) e nunca imprime credenciais.
 *
 * Uso: npx tsx scripts/aws/setup-db-user.ts
 * Idempotente: se o usuário já existir, gera senha nova e atualiza o .env.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import pg from 'pg';

const REGION = 'sa-east-1';
const INSTANCE = 'mecanica-db';
const DB_NAME = 'mecanica';
const APP_USER = 'mecanica_app';
const AWS = process.platform === 'win32' ? 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe' : 'aws';

function aws(args: string[]): string {
  return execFileSync(AWS, [...args, '--region', REGION, '--output', 'json'], { encoding: 'utf8' });
}

async function main() {
  const instance = JSON.parse(aws(['rds', 'describe-db-instances', '--db-instance-identifier', INSTANCE])).DBInstances[0];
  const host: string = instance.Endpoint.Address;
  const port: number = instance.Endpoint.Port;
  const secretArn: string = instance.MasterUserSecret.SecretArn;

  const secret = JSON.parse(JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', secretArn])).SecretString);

  const master = new pg.Client({
    host, port, database: DB_NAME, user: secret.username, password: secret.password,
    ssl: { rejectUnauthorized: false },
  });
  await master.connect();

  // Hex: sem caracteres que precisem de escape na URL.
  const appPassword = randomBytes(24).toString('hex');
  const exists = (await master.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_USER])).rowCount;
  // Identificador e senha não aceitam parâmetro ($1) em DDL; valores são constantes/hex gerados aqui.
  await master.query(`${exists ? 'ALTER' : 'CREATE'} ROLE ${APP_USER} LOGIN PASSWORD '${appPassword}'`);
  await master.query(`GRANT CONNECT ON DATABASE ${DB_NAME} TO ${APP_USER}`);
  await master.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${APP_USER}`);
  await master.end();

  const url = `postgres://${APP_USER}:${appPassword}@${host}:${port}/${DB_NAME}?sslmode=require`;
  const envPath = '.env';
  const lines = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const kept = lines.filter((l) => !/^#?\s*DATABASE_URL=/.test(l));
  kept.push(`DATABASE_URL="${url}"`);
  writeFileSync(envPath, kept.join('\n').replace(/\n*$/, '\n'));

  console.log(`OK: usuário ${APP_USER} ${exists ? 'atualizado' : 'criado'} em ${host}. DATABASE_URL gravado no .env (senha não exibida).`);
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
