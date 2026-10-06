import pg from 'pg';
import { poolConfig } from '../db/client';
import type { ChangeBus, Resource } from './events';

export const CHANGES_CHANNEL = 'mecanica_changes';

const RESOURCES = new Set<Resource>([
  'products', 'categories', 'transactions', 'serviceOrders',
  'notifications', 'users', 'settings', 'accessRequests',
]);

interface Log {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

/**
 * Conexão dedicada com LISTEN no canal das triggers (migração 0001_realtime_notify) que
 * repassa cada aviso para o ChangeBus. Assim o SSE também reflete escritas feitas fora
 * desta instância. Reconecta sozinha com espera crescente (1 s → 30 s).
 */
export function startPgChangeListener(url: string, bus: ChangeBus, log: Log): () => Promise<void> {
  let client: pg.Client | undefined;
  let stopped = false;
  let delay = 1000;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = (err: unknown) => {
    client?.removeAllListeners();
    client = undefined;
    if (stopped) return;
    log.warn({ err: err instanceof Error ? err.message : err, retryInMs: delay }, 'Realtime: conexão LISTEN caiu');
    retry = setTimeout(connect, delay);
    delay = Math.min(delay * 2, 30_000);
  };

  async function connect() {
    const c = new pg.Client(poolConfig(url));
    // Uma queda dispara 'error' e depois 'end': reconecta uma vez só.
    let down = false;
    const onDown = (err: unknown) => {
      if (down) return;
      down = true;
      scheduleReconnect(err);
    };
    c.on('error', onDown);
    c.on('end', () => onDown('conexão encerrada'));
    c.on('notification', (msg) => {
      if (msg.channel === CHANGES_CHANNEL && RESOURCES.has(msg.payload as Resource)) {
        bus.emitChange(msg.payload as Resource);
      }
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${CHANGES_CHANNEL}`);
      client = c;
      delay = 1000;
      log.info({ channel: CHANGES_CHANNEL }, 'Realtime: ouvindo mudanças do banco');
    } catch (err) {
      down = true;
      c.removeAllListeners();
      await c.end().catch(() => {});
      scheduleReconnect(err);
    }
  }

  connect();

  return async () => {
    stopped = true;
    clearTimeout(retry);
    const c = client;
    client = undefined;
    c?.removeAllListeners();
    await c?.end().catch(() => {});
  };
}
