/**
 * Libera o cadastro pelo próprio usuário no Cognito ("Criar conta" na tela de login)
 * e deixa o e-mail de código de verificação em português.
 * Contas novas entram como pendentes no app até um admin aprovar.
 *
 * UpdateUserPool substitui o que não for enviado, então copiamos a config atual.
 * Uso: npx tsx scripts/aws/enable-self-signup.ts
 */
import 'dotenv/config';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const REGION = process.env.AWS_REGION || 'sa-east-1';
const POOL_ID = process.env.COGNITO_USER_POOL_ID!;

async function main() {
  const idp = new CognitoIdentityProviderClient({ region: REGION });
  const { UserPool: p } = await idp.send(new DescribeUserPoolCommand({ UserPoolId: POOL_ID }));
  if (!p) throw new Error('User pool não encontrado');

  await idp.send(new UpdateUserPoolCommand({
    UserPoolId: POOL_ID,
    Policies: p.Policies,
    DeletionProtection: p.DeletionProtection,
    LambdaConfig: p.LambdaConfig,
    AutoVerifiedAttributes: p.AutoVerifiedAttributes,
    MfaConfiguration: p.MfaConfiguration,
    DeviceConfiguration: p.DeviceConfiguration,
    EmailConfiguration: p.EmailConfiguration,
    SmsConfiguration: p.SmsConfiguration,
    UserPoolTags: p.UserPoolTags,
    UserPoolAddOns: p.UserPoolAddOns,
    AccountRecoverySetting: p.AccountRecoverySetting,
    UserAttributeUpdateSettings: p.UserAttributeUpdateSettings,
    AdminCreateUserConfig: { ...p.AdminCreateUserConfig, AllowAdminCreateUserOnly: false },
    VerificationMessageTemplate: {
      DefaultEmailOption: 'CONFIRM_WITH_CODE',
      EmailSubject: 'Seu código de verificação - Munago Estoque',
      EmailMessage: 'Olá! Seu código de verificação do Munago Estoque é {####}. Ele vale por 24 horas.',
    },
  }));

  const { UserPool: after } = await idp.send(new DescribeUserPoolCommand({ UserPoolId: POOL_ID }));
  console.log('Auto-cadastro:', after?.AdminCreateUserConfig?.AllowAdminCreateUserOnly ? 'DESLIGADO' : 'LIGADO');
  console.log('Proteção contra exclusão:', after?.DeletionProtection);
  console.log('Política de senha mínima:', after?.Policies?.PasswordPolicy?.MinimumLength);
  console.log('Assunto do convite mantido:', after?.AdminCreateUserConfig?.InviteMessageTemplate?.EmailSubject);
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
