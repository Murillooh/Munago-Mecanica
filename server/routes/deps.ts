import type { DB } from '../db/client';
import type { ChangeBus } from '../realtime/events';
import type { CognitoAdmin } from '../auth/cognito';

export interface ApiDeps {
  db: DB;
  bus: ChangeBus;
  cognito: CognitoAdmin;
}

export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export const newId = () => crypto.randomUUID();
