import type { RequestHandler } from 'express';
import type { ChangeBus, Resource } from './events';

/**
 * EventSource não envia header Authorization: só em /events o token vem por query.
 * Copia para o header antes do authMiddleware.
 */
export const sseTokenFromQuery: RequestHandler = (req, _res, next) => {
  if (req.path === '/events' && typeof req.query.token === 'string' && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

const COALESCE_MS = 150;

export function sseHandler(bus: ChangeBus): RequestHandler {
  return (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');

    // A mesma escrita chega duas vezes (rota da API + trigger do banco): junta numa janela curta
    // para o cliente refazer cada GET uma vez só.
    const pending = new Set<Resource>();
    let flush: ReturnType<typeof setTimeout> | undefined;
    const onChange = (r: Resource) => {
      pending.add(r);
      flush ??= setTimeout(() => {
        flush = undefined;
        for (const p of pending) res.write(`event: change\ndata: ${p}\n\n`);
        pending.clear();
      }, COALESCE_MS);
    };
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    bus.on('change', onChange);
    req.on('close', () => {
      clearInterval(ping);
      clearTimeout(flush);
      bus.off('change', onChange);
    });
  };
}
