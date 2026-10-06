import { EventEmitter } from 'node:events';

export type Resource =
  | 'products' | 'categories' | 'transactions' | 'serviceOrders'
  | 'notifications' | 'users' | 'settings' | 'accessRequests';

/**
 * Avisa quem está ouvindo (SSE) que um recurso mudou; o cliente refaz o GET.
 * Alimentado pelas rotas e pelo LISTEN/NOTIFY do banco (pgListener), que cobre escritas de fora da API.
 */
export class ChangeBus extends EventEmitter {
  emitChange(...resources: Resource[]) {
    for (const r of new Set(resources)) this.emit('change', r);
  }
}
