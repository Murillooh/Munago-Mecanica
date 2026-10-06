import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHarness, TOKENS } from '../test/apiHarness';

describe('GET /events (SSE)', () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  async function listen() {
    const h = await createHarness();
    server = h.app.listen(0);
    const { port } = server.address() as AddressInfo;
    return { h, base: `http://127.0.0.1:${port}/api/v1` };
  }

  it('recebe token pela query e entrega mudanças', async () => {
    const { h, base } = await listen();
    const ctrl = new AbortController();
    const res = await fetch(`${base}/events?token=${encodeURIComponent(TOKENS.viewer)}`, { signal: ctrl.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    h.bus.emitChange('products');
    let text = '';
    while (!text.includes('data: products')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    expect(text).toContain('event: change\ndata: products\n\n');
    ctrl.abort();
  });

  it('sem token → 401; pendente → 403', async () => {
    const { base } = await listen();
    expect((await fetch(`${base}/events`)).status).toBe(401);
    expect((await fetch(`${base}/events?token=${encodeURIComponent(TOKENS.pending)}`)).status).toBe(403);
  });

  it('token na query só vale para /events', async () => {
    const { base } = await listen();
    expect((await fetch(`${base}/products?token=${encodeURIComponent(TOKENS.viewer)}`)).status).toBe(401);
  });

  it('remove o listener quando o cliente desconecta', async () => {
    const { h, base } = await listen();
    const ctrl = new AbortController();
    const res = await fetch(`${base}/events?token=${encodeURIComponent(TOKENS.viewer)}`, { signal: ctrl.signal });
    await res.body!.getReader().read();
    const before = h.bus.listenerCount('change');
    ctrl.abort();
    await new Promise((r) => setTimeout(r, 100));
    expect(h.bus.listenerCount('change')).toBe(before - 1);
  });
});
