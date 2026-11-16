import type { Permissions } from '../db/schema';

/** Etapas da OS da moto, na ordem do fluxo. Compartilhado com o front. */
export const MOTO_STATUSES = [
  'recebida', 'aguardando_estoque', 'aguardando_peca', 'aguardando_autorizacao', 'autorizada', 'em_manutencao', 'finalizada', 'entregue', 'recusada',
] as const;
export type MotoStatus = (typeof MOTO_STATUSES)[number];

/** Etapas como a operação enxerga: Front, Mecânico, Estoque, CS, Franqueado, Manutenção, Finalizada. */
export const MOTO_STEPS = ['Front', 'Mecânico', 'Estoque', 'CS', 'Franqueado', 'Manutenção', 'Finalizada', 'Entregue'] as const;

/** Em qual das 7 etapas a OS está. "Franqueado" = CS já pediu a autorização e aguarda a resposta. */
export function motoStep(os: { status: MotoStatus; events: { type: string }[] }): number {
  switch (os.status) {
    case 'recebida': return 1;
    case 'aguardando_estoque': case 'aguardando_peca': return 2;
    case 'aguardando_autorizacao': case 'recusada': return os.events.some(e => e.type === 'request_auth') ? 4 : 3;
    case 'autorizada': case 'em_manutencao': return 5;
    case 'finalizada': return 6;
    case 'entregue': return 7;
  }
}

/** Rótulo da etapa atual (distingue "Aguardando CS" de "Aguardando franqueado"). */
export function motoStatusLabel(os: { status: MotoStatus; events: { type: string }[] }): string {
  if (os.status === 'aguardando_autorizacao' && os.events.some(e => e.type === 'request_auth')) return 'Aguardando franqueado';
  return MOTO_STATUS_LABEL[os.status];
}

export const MOTO_STATUS_LABEL: Record<MotoStatus, string> = {
  recebida: 'Aguardando mecânico',
  aguardando_estoque: 'Aguardando estoque',
  aguardando_peca: 'Aguardando peça',
  aguardando_autorizacao: 'Aguardando CS',
  autorizada: 'Autorizada',
  em_manutencao: 'Em manutenção',
  finalizada: 'Pronta para entrega',
  entregue: 'Entregue ao locatário',
  recusada: 'Recusada',
};

/** Peça/serviço que o mecânico pede. `available` é marcado pelo estoque. */
export interface MotoItem {
  code: string;
  description: string;
  quantity: number;
  purpose: string;
  available?: boolean;
}

/** Prazo máximo que o mecânico pode dar a um serviço. */
export const MAX_ESTIMATE_MINUTES = 90;

export type MotoAction = 'diagnose' | 'stock_ok' | 'stock_missing' | 'request_auth' | 'authorize' | 'reject' | 'start' | 'finish' | 'deliver';

/** Registro da linha do tempo: tudo que aconteceu com a moto, em ordem. */
export interface MotoEvent {
  type: 'recebida' | MotoAction;
  at: string;
  by: string;
  byName: string;
  note?: string;
}

/** De qual etapa cada ação parte, para qual vai e quem pode fazer. */
export const MOTO_ACTIONS: Record<MotoAction, { from: MotoStatus[]; to: MotoStatus; perm: keyof Permissions; label: string; done: string }> = {
  diagnose: { from: ['recebida'], to: 'aguardando_estoque', perm: 'canManageOS', label: 'Enviar para o estoque', done: 'Mecânico lançou o diagnóstico' },
  stock_ok: { from: ['aguardando_estoque', 'aguardando_peca'], to: 'aguardando_autorizacao', perm: 'canManageInventory', label: 'Peças disponíveis', done: 'Estoque confirmou as peças' },
  stock_missing: { from: ['aguardando_estoque'], to: 'aguardando_peca', perm: 'canManageInventory', label: 'Falta peça', done: 'Estoque sem peça' },
  request_auth: { from: ['aguardando_autorizacao'], to: 'aguardando_autorizacao', perm: 'canApproveOS', label: 'Pedir autorização', done: 'Pedido de autorização enviado ao franqueado' },
  authorize: { from: ['aguardando_autorizacao'], to: 'autorizada', perm: 'canApproveOS', label: 'Autorizar serviço', done: 'CS autorizou o serviço' },
  reject: { from: ['aguardando_autorizacao'], to: 'recusada', perm: 'canApproveOS', label: 'Recusar', done: 'CS recusou o serviço' },
  start: { from: ['autorizada'], to: 'em_manutencao', perm: 'canManageOS', label: 'Iniciar manutenção', done: 'Manutenção iniciada' },
  finish: { from: ['em_manutencao'], to: 'finalizada', perm: 'canManageOS', label: 'Finalizar manutenção', done: 'Manutenção finalizada' },
  deliver: { from: ['finalizada'], to: 'entregue', perm: 'canCheckin', label: 'Entregar ao locatário', done: 'Moto entregue ao locatário' },
};

/** Quem precisa agir quando a OS chega em cada etapa (recebe o aviso) e o texto do aviso. */
export const MOTO_NOTIFY: Partial<Record<MotoStatus, { target: keyof Permissions; text: string }>> = {
  recebida: { target: 'canManageOS', text: 'chegou para diagnóstico' },
  aguardando_estoque: { target: 'canManageInventory', text: 'precisa de conferência de peças' },
  aguardando_autorizacao: { target: 'canApproveOS', text: 'aguarda sua autorização' },
  autorizada: { target: 'canManageOS', text: 'foi autorizada: pode iniciar a manutenção' },
  recusada: { target: 'canManageOS', text: 'foi recusada pelo CS' },
  finalizada: { target: 'canCheckin', text: 'está pronta para entrega' },
};

/** Fase do cronômetro em relação ao tempo estimado pelo mecânico. */
export interface TimeStage { emoji: string; label: string; pct: number; late: boolean; tone: 'green' | 'yellow' | 'orange' | 'red' }

export function timeStage(elapsedMs: number, estimatedMinutes: number): TimeStage {
  const pct = elapsedMs / (estimatedMinutes * 60_000);
  if (pct > 1) return { emoji: '🔴', label: 'Passou do prazo', pct, late: true, tone: 'red' };
  if (pct >= 0.85) return { emoji: '🟠', label: 'Perto do prazo', pct, late: false, tone: 'orange' };
  if (pct >= 0.5) return { emoji: '🟡', label: 'Na metade do tempo', pct, late: false, tone: 'yellow' };
  return { emoji: '🟢', label: 'No prazo', pct, late: false, tone: 'green' };
}

/** Duração legível: "1 h 05 min", "12 min", "45 s". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
  if (m) return `${m} min`;
  return `${s} s`;
}
