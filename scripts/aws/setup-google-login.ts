/**
 * Liga o login com Google no Cognito:
 *  1. cria/atualiza o provedor de identidade Google (lê GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET do .env)
 *  2. habilita OAuth no app client web (callback/logout URLs, scopes)
 *  3. grava VITE_COGNITO_DOMAIN no .env (o botão do Google só aparece com ele)
 * Nunca imprime o secret. Idempotente.
 *
 * Uso: npx tsx scripts/aws/setup-google-login.ts [urlDoApp ...]
 *   ex.: npx tsx scripts/aws/setup-google-login.ts http://localhost:3000 https://app.suaoficina.com.br
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  UpdateIdentityProviderCommand,
  DescribeUserPoolClientCommand,
  DescribeUserPoolCommand,
  UpdateUserPoolClientCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION || 'sa-east-1';
const POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const appUrls = (process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:3000'])
  .map((u) => u.replace(/\/$/, ''));

function setEnvVar(name: string, value: string) {
  const lines = existsSync('.env') ? readFileSync('.env', 'utf8').split(/\r?\n/) : [];
  const kept = lines.filter((l) => !new RegExp(`^#?\\s*${name}=`).test(l));
  kept.push(`${name}="${value}"`);
  writeFileSync('.env', kept.join('\n').replace(/\n*$/, '\n'));
}

async function main() {
  if (!POOL_ID || !CLIENT_ID) throw new Error('COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID ausentes no .env');
  if (!GOOGLE_ID || !GOOGLE_SECRET) throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes no .env');

  const idp = new CognitoIdentityProviderClient({ region: REGION });

  const provider = {
    UserPoolId: POOL_ID,
    ProviderName: 'Google',
    ProviderDetails: {
      client_id: GOOGLE_ID,
      client_secret: GOOGLE_SECRET,
      authorize_scopes: 'openid email profile',
    },
    // email_verified: o servidor só vincula/dá admin com e-mail verificado.
    AttributeMapping: { email: 'email', email_verified: 'email_verified', name: 'name', username: 'sub' },
  };

  try {
    await idp.send(new UpdateIdentityProviderCommand(provider));
    console.log('Provedor Google atualizado.');
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
    await idp.send(new CreateIdentityProviderCommand({ ...provider, ProviderType: 'Google' }));
    console.log('Provedor Google criado.');
  }

  // UpdateUserPoolClient substitui a config inteira: parte da atual para não perder nada.
  const { UserPoolClient: current } = await idp.send(new DescribeUserPoolClientCommand({ UserPoolId: POOL_ID, ClientId: CLIENT_ID }));
  if (!current) throw new Error('App client não encontrado');
  await idp.send(new UpdateUserPoolClientCommand({
    UserPoolId: POOL_ID,
    ClientId: CLIENT_ID,
    ClientName: current.ClientName,
    ExplicitAuthFlows: current.ExplicitAuthFlows,
    PreventUserExistenceErrors: current.PreventUserExistenceErrors,
    RefreshTokenValidity: current.RefreshTokenValidity,
    AccessTokenValidity: current.AccessTokenValidity,
    IdTokenValidity: current.IdTokenValidity,
    TokenValidityUnits: current.TokenValidityUnits,
    SupportedIdentityProviders: ['COGNITO', 'Google'],
    AllowedOAuthFlowsUserPoolClient: true,
    AllowedOAuthFlows: ['code'],
    AllowedOAuthScopes: ['openid', 'email', 'profile'],
    CallbackURLs: appUrls.map((u) => `${u}/`),
    LogoutURLs: appUrls.map((u) => `${u}/`),
  }));
  console.log(`App client liberado para login Google em: ${appUrls.join(', ')}`);

  const { UserPool } = await idp.send(new DescribeUserPoolCommand({ UserPoolId: POOL_ID }));
  if (!UserPool?.Domain) throw new Error('O pool não tem domínio do Cognito configurado.');
  const domain = `${UserPool.Domain}.auth.${REGION}.amazoncognito.com`;
  setEnvVar('VITE_COGNITO_DOMAIN', domain);
  console.log(`VITE_COGNITO_DOMAIN=${domain} gravado no .env. Reinicie o servidor (npm run dev).`);
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
