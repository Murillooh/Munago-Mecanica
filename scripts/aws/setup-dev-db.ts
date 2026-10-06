/**
 * Cria o banco `mecanica_dev` na mesma instância RDS e aponta o .env local para ele.
 * O banco `mecanica` (produção, usado pelo Beanstalk) não é tocado.
 *
 * Uso: npx tsx scripts/aws/setup-dev-db.ts   (depois: npx tsx scripts/db/migrate.ts)
 * Idempotente. A URL de produção fica guardada em DATABASE_URL_PROD no .env; nada é impresso.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const REGION = 'sa-east-1';
const INSTANCE = 'mecanica-db';
const DEV_DB = 'mecanica_dev';
const APP_USER = 'mecanica_app';
const AWS = process.platform === 'win32' ? 'C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe' : 'aws';

function aws(args: string[]): string {
  return execFileSync(AWS, [...args, '--region', REGION, '--output', 'json'], { encoding: 'utf8' });
}

function readEnv(): { lines: string[]; get: (k: string) => string | undefined } {
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
  const get = (k: string) => {
    const line = lines.find((l) => l.startsWith(`${k}=`));
    return line?.slice(k.length + 1).replace(/^"|"$/g, '');
  };
  return { lines, get };
}

async function main() {
  const env = readEnv();
  const prodUrl = env.get('DATABASE_URL_PROD') ?? env.get('DATABASE_URL');
  if (!prodUrl) throw new Error('DATABASE_URL não encontrada no .env');
  if (new URL(prodUrl).pathname === `/${DEV_DB}`) throw new Error('DATABASE_URL já aponta para o dev e não há DATABASE_URL_PROD');

  const instance = JSON.parse(aws(['rds', 'describe-db-instances', '--db-instance-identifier', INSTANCE])).DBInstances[0];
  const secret = JSON.parse(JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', instance.MasterUserSecret.SecretArn])).SecretString);
  const base = { host: instance.Endpoint.Address, port: instance.Endpoint.Port, user: secret.username, password: secret.password, ssl: { rejectUnauthorized: false } };

  const admin = new pg.Client({ ...base, database: 'postgres' });
  await admin.connect();
  const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DEV_DB])).rowCount;
  // Nome do banco e do usuário são constantes deste arquivo (DDL não aceita parâmetro).
  if (!exists) await admin.query(`CREATE DATABASE ${DEV_DB}`);
  await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${DEV_DB} TO ${APP_USER}`);
  await admin.end();

  const dev = new pg.Client({ ...base, database: DEV_DB });
  await dev.connect();
  await dev.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${APP_USER}`);
  await dev.end();

  const devUrl = new URL(prodUrl);
  devUrl.pathname = `/${DEV_DB}`;
  const kept = env.lines.filter((l) => !/^#?\s*DATABASE_URL(_PROD)?=/.test(l));
  kept.push(`# Produção (Beanstalk usa a própria variável; aqui fica só de referência)`, `DATABASE_URL_PROD="${prodUrl}"`, `DATABASE_URL="${devUrl.toString()}"`);
  writeFileSync('.env', kept.join('\n').replace(/\n*$/, '\n'));

  console.log(`OK: banco ${DEV_DB} ${exists ? 'já existia' : 'criado'}. .env local agora usa ${DEV_DB} (credenciais não exibidas).`);
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
