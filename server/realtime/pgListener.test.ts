import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Cliente pg falso: conecta na hora e deixa o teste emitir eventos de queda.
const clients: FakeClient[] = [];
class FakeClient extends EventEmitter {
  connect = vi.fn(async () => {});
  query = vi.fn(async () => ({}));
  end = vi.fn(async () => { this.emit('end'); });
  constructor() { super(); clients.push(this); }
}
vi.mock('pg', () => ({ default: { Client: FakeClient } }));
vi.mock('../db/client', () => ({ poolConfig: () => ({}) }));

const { startPgChangeListener } = await import('./pgListener');
const { ChangeBus } = await import('./events');

const log = { info: vi.fn(), warn: vi.fn() };
const flush = () => new Promise((r) => setImmediate(r));

describe('startPgChangeListener', () => {
  afterEach(() => { clients.length = 0; vi.useRealTimers(); });

  it('queda com dois "error" seguidos não derruba o processo e reconecta uma vez', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const stop = startPgChangeListener('postgres://x', new ChangeBus(), log);
    await flush();
    expect(clients).toHaveLength(1);

    const dead = clients[0];
    // Antes: o 1º error removia todos os listeners e o 2º virava "Unhandled 'error' event".
    expect(() => {
      dead.emit('error', new Error('read ECONNRESET'));
      dead.emit('error', new Error('Connection terminated unexpectedly'));
      dead.emit('end');
    }).not.toThrow();

    vi.advanceTimersByTime(1000);
    await flush();
    expect(clients).toHaveLength(2); // uma reconexão só
    await stop();
  });

  it('repassa notificações válidas para o ChangeBus', async () => {
    const bus = new ChangeBus();
    const seen: string[] = [];
    bus.on('change', (r) => seen.push(r));
    const stop = startPgChangeListener('postgres://x', bus, log);
    await flush();
    clients[0].emit('notification', { channel: 'mecanica_changes', payload: 'products' });
    clients[0].emit('notification', { channel: 'mecanica_changes', payload: 'qualquer_coisa' });
    expect(seen).toEqual(['products']);
    await stop();
  });
});
