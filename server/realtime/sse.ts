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

    const onChange = (r: Resource) => res.write(`event: change\ndata: ${r}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    bus.on('change', onChange);
    req.on('close', () => {
      clearInterval(ping);
      bus.off('change', onChange);
    });
  };
}
