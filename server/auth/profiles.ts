import type { Permissions } from '../db/schema';

/** Perfis de acesso: cada um define o cargo base e as permissões. Compartilhado com o front. */
export const PROFILE_IDS = ['admin', 'gestor', 'recepcao', 'mecanico', 'cs', 'estoquista'] as const;
export type Profile = (typeof PROFILE_IDS)[number];

const none: Permissions = {
  canManageInventory: false, canPerformTransactions: false, canManageOS: false, canViewReports: false,
  canManageUsers: false, canCheckin: false, canApproveOS: false,
};

export const PROFILES: Record<Profile, { label: string; description: string; role: 'admin' | 'editor' | 'viewer'; permissions: Permissions }> = {
  admin: {
    label: 'Administrador', description: 'Responsável pela Base: aprova acessos, equipe, estoque, OS e configurações.', role: 'admin',
    permissions: { canManageInventory: true, canPerformTransactions: true, canManageOS: true, canViewReports: true, canManageUsers: true, canCheckin: true, canApproveOS: true },
  },
  gestor: {
    label: 'Gestor', description: 'Acompanha painel e relatórios da Base, sem alterar nada.', role: 'viewer',
    permissions: { ...none, canViewReports: true },
  },
  recepcao: {
    label: 'Setor Front', description: 'Recebe a moto: check-list com fotos, km e observações. Entrega a moto pronta.', role: 'viewer',
    permissions: { ...none, canCheckin: true },
  },
  mecanico: {
    label: 'Mecânico', description: 'Diz o que a moto precisa e o prazo; depois de autorizado, faz e finaliza a manutenção.', role: 'editor',
    permissions: { ...none, canManageOS: true },
  },
  cs: {
    label: 'Time CS', description: 'Pede a autorização ao franqueado (e-mail/WhatsApp) e anexa a aprovação.', role: 'viewer',
    permissions: { ...none, canApproveOS: true },
  },
  estoquista: {
    label: 'Setor de Estoque', description: 'Confere se as peças pedidas pelo mecânico têm em estoque.', role: 'editor',
    permissions: { ...none, canManageInventory: true, canPerformTransactions: true },
  },
};
