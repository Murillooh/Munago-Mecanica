import type { DB } from '../db/client';
import type { ChangeBus } from '../realtime/events';
import type { CognitoAdmin } from '../auth/cognito';
import type { PaymentGateway } from '../services/asaas';

export interface ApiDeps {
  db: DB;
  bus: ChangeBus;
  cognito: CognitoAdmin;
  /** Asaas; ausente quando ASAAS_API_KEY não está configurada (cobrança responde 503). */
  payments?: PaymentGateway;
}

export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export const newId = () => crypto.randomUUID();
