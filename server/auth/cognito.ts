import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  ListUsersCommand,
  UserNotFoundException,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ApiError } from '../middleware/errorHandler';
import type { TokenVerifier } from './middleware';

export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

/** Valida ID tokens (trazem email, email_verified e name). */
export function createCognitoVerifier(cfg: CognitoConfig): TokenVerifier {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: cfg.userPoolId,
    clientId: cfg.clientId,
    tokenUse: 'id',
  });
  return { verify: (token) => verifier.verify(token) };
}

export interface CognitoAdmin {
  /** Cria o usuário; o Cognito envia e-mail com senha temporária. Retorna o sub. */
  createUser(email: string, name: string): Promise<string>;
  disableUser(email: string): Promise<void>;
  /** Apaga todas as contas de login com este e-mail (senha e Google). */
  deleteUser(email: string): Promise<void>;
}

export function createCognitoAdmin(cfg: CognitoConfig): CognitoAdmin {
  // Credenciais vêm da cadeia padrão da AWS (aws configure em dev, role IAM em produção).
  const idp = new CognitoIdentityProviderClient({ region: cfg.region });

  return {
    async createUser(email, name) {
      try {
        const out = await idp.send(new AdminCreateUserCommand({
          UserPoolId: cfg.userPoolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: name },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }));
        const sub = out.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
        if (!sub) throw new Error('Cognito não retornou o sub do usuário');
        return sub;
      } catch (e) {
        if (e instanceof UsernameExistsException) {
          throw new ApiError(409, 'USER_EXISTS', 'Já existe um usuário com este e-mail.');
        }
        throw e;
      }
    },

    async disableUser(email) {
      await idp.send(new AdminDisableUserCommand({ UserPoolId: cfg.userPoolId, Username: email }));
    },

    async deleteUser(email) {
      // Quem entra com Google vira "Google_<id>" no Cognito: apagar pelo e-mail não achava essa conta.
      const safe = email.replace(/["\\]/g, '');
      let usernames: string[];
      try {
        const out = await idp.send(new ListUsersCommand({ UserPoolId: cfg.userPoolId, Filter: `email = "${safe}"` }));
        usernames = (out.Users ?? []).map((u) => u.Username).filter((n): n is string => !!n);
      } catch (e) {
        // Sem cognito-idp:ListUsers na role: apaga ao menos a conta de senha (o bloqueio no banco segura o resto).
        if ((e as { name?: string })?.name !== 'AccessDeniedException') throw e;
        usernames = [email];
      }
      for (const username of usernames) {
        try {
          await idp.send(new AdminDeleteUserCommand({ UserPoolId: cfg.userPoolId, Username: username }));
        } catch (e) {
          if (!(e instanceof UserNotFoundException)) throw e;
        }
      }
    },
  };
}
