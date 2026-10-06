import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  signInWithRedirect,
  confirmSignIn,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';
// Conclui o login do Google quando o navegador volta do Cognito com ?code=...
import 'aws-amplify/auth/enable-oauth-listener';

const appUrl = `${window.location.origin}/`;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
        ...(cognitoDomain && {
          oauth: {
            domain: cognitoDomain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [appUrl],
            redirectSignOut: [appUrl],
            responseType: 'code' as const,
          },
        }),
      },
    },
  },
});

export const isGoogleLoginEnabled = Boolean(cognitoDomain);

/** True quando a página carregou na volta do Google (?code=&state=); a sessão chega pelo Hub. */
export const isOAuthReturn = () => {
  const p = new URLSearchParams(window.location.search);
  return p.has('code') && p.has('state');
};

/** Vai para a tela do Google; volta para o app já autenticado. */
export async function loginWithGoogle() {
  await signOut().catch(() => {});
  await signInWithRedirect({ provider: 'Google' });
}

/** ID token (traz email/name) — renovado automaticamente pelo Amplify quando expira. */
export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export type LoginResult = 'DONE' | 'NEW_PASSWORD_REQUIRED';

export async function login(email: string, password: string): Promise<LoginResult> {
  // Sessão anterior presa (ex.: aba antiga) faz o signIn falhar com UserAlreadyAuthenticatedException.
  await signOut().catch(() => {});
  const r = await signIn({ username: email.trim().toLowerCase(), password });
  if (r.isSignedIn) return 'DONE';
  if (r.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return 'NEW_PASSWORD_REQUIRED';
  throw new Error(`Etapa de login não suportada: ${r.nextStep.signInStep}`);
}

/** Primeiro acesso: troca a senha temporária enviada por e-mail. */
export async function completeNewPassword(newPassword: string) {
  const r = await confirmSignIn({ challengeResponse: newPassword });
  if (!r.isSignedIn) throw new Error('Não foi possível concluir o login.');
}

export const requestPasswordReset = (email: string) => resetPassword({ username: email.trim().toLowerCase() });

export const confirmPasswordReset = (email: string, code: string, newPassword: string) =>
  confirmResetPassword({ username: email.trim().toLowerCase(), confirmationCode: code.trim(), newPassword });

export const logout = () => signOut();

/** Mensagens em português para os erros do Cognito. */
export function authErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'E-mail ou senha incorretos.';
    case 'UserNotConfirmedException':
      return 'Conta ainda não confirmada. Fale com o administrador.';
    case 'PasswordResetRequiredException':
      return 'É preciso redefinir sua senha. Use "Esqueceu a senha?".';
    case 'InvalidPasswordException':
      return 'A senha precisa ter ao menos 8 caracteres, com letras minúsculas e números.';
    case 'CodeMismatchException':
      return 'Código inválido.';
    case 'ExpiredCodeException':
      return 'Código expirado. Solicite um novo.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'EmptySignInUsername':
    case 'EmptySignInPassword':
      return 'Informe e-mail e senha.';
    default:
      return (e as Error)?.message || 'Ocorreu um erro. Tente novamente.';
  }
}
