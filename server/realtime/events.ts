import { EventEmitter } from 'node:events';

export type Resource =
  | 'products' | 'categories' | 'transactions' | 'serviceOrders'
  | 'notifications' | 'users' | 'settings' | 'accessRequests';

/**
 * Avisa quem está ouvindo (SSE) que um recurso mudou; o cliente refaz o GET.
 * Em memória: funciona com uma instância do servidor. Para várias, trocar por LISTEN/NOTIFY.
 */
export class ChangeBus extends EventEmitter {
  emitChange(...resources: Resource[]) {
    for (const r of new Set(resources)) this.emit('change', r);
  }
}
