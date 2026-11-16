import { EventEmitter } from 'node:events';

export type Resource =
  | 'products' | 'categories' | 'transactions' | 'serviceOrders'
  | 'notifications' | 'users' | 'settings' | 'accessRequests' | 'workspaces' | 'services' | 'motoCheckins';

/** Escopo de aviso que só o admin geral recebe (cadastros, pedidos de acesso). */
export const ADMIN_SCOPE = '*';

/**
 * Avisa quem está ouvindo (SSE) que um recurso mudou; o cliente refaz o GET.
 * `scope` é o id da oficina onde a mudança aconteceu: só os usuários dela (e o admin geral) recebem.
 * Alimentado pelas rotas e pelo LISTEN/NOTIFY do banco (pgListener), que cobre escritas de fora da API.
 */
export class ChangeBus extends EventEmitter {
  emitChange(scope: string, ...resources: Resource[]) {
    for (const r of new Set(resources)) this.emit('change', r, scope);
  }
}
