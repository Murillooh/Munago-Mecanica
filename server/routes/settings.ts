import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { settings, workspaces } from '../db/schema';
import type { DB } from '../db/client';
import { requireAdmin, requirePermission, ws } from '../auth/middleware';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import logger from '../utils/logger.js';
import type { ApiDeps } from './deps';

export const DEFAULT_SETTINGS = {
  storeName: 'Munago Mecânica',
  allowNegativeStock: false,
  accentColor: '#2563eb',
  autoBackupEnabled: false,
  enableSoundAlerts: true,
  monitorAutoScrollEnabled: true,
  monitorScrollIntervalSeconds: 12,
  lastBackup: '',
};

export type SystemSettings = typeof DEFAULT_SETTINGS & {
  logoUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  /** Carteira Asaas da oficina: recebe a parte dela no split das cobranças. Só o admin geral altera. */
  asaasWalletId?: string;
  /** Repasse mínimo da OS para a empresa, em % do total. Só o admin geral altera. */
  repasseMinPercent?: number;
};

/** Campos que mexem no dinheiro da empresa: a própria oficina não pode alterar. */
const SUPER_ADMIN_FIELDS = ['asaasWalletId', 'repasseMinPercent'] as const;

const settingsPatch = z.object({
  storeName: z.string().min(1).max(100),
  logoUrl: z.string().max(500_000), // pode ser data URL de imagem
  contactPhone: z.string().max(50),
  contactEmail: z.string().max(200),
  address: z.string().max(500),
  allowNegativeStock: z.boolean(),
  accentColor: z.string().max(30),
  autoBackupEnabled: z.boolean(),
  enableSoundAlerts: z.boolean(),
  monitorAutoScrollEnabled: z.boolean(),
  monitorScrollIntervalSeconds: z.number().int().min(3).max(600),
  asaasWalletId: z.string().trim().max(100),
  repasseMinPercent: z.number().min(0).max(100),
}).partial().strict();

/** Configurações de uma oficina (a linha de settings usa o id da oficina). */
export async function getSettings(db: DB, workspaceId: string): Promise<SystemSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, workspaceId));
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) } as SystemSettings;
}

export async function mergeSettings(db: DB, workspaceId: string, patch: Record<string, unknown>) {
  await db.insert(settings).values({ id: workspaceId, data: patch })
    .onConflictDoUpdate({
      target: settings.id,
      set: { data: sql`${settings.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: sql`now()` },
    });
}

export function createSettingsRouter({ db, bus }: ApiDeps) {
  const r = Router();

  r.get('/settings', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await getSettings(db, ws(req)));
  }));

  // Antes qualquer aprovado podia alterar (firestore.rules); agora só admin.
  r.patch('/settings', requireAdmin, asyncHandler(async (req, res) => {
    const patch = settingsPatch.parse(req.body);
    const current = await getSettings(db, ws(req));
    // A tela manda o formulário inteiro: só recusa se o valor realmente mudou.
    const changed = SUPER_ADMIN_FIELDS.filter((k) => k in patch && (patch[k] ?? '') !== (current[k] ?? ''));
    if (changed.length && !req.user!.isSuperAdmin) {
      throw new ApiError(403, 'SUPER_ADMIN_ONLY', 'Carteira e repasse mínimo só podem ser alterados pela administração da Munago.');
    }
    if (changed.includes('asaasWalletId')) {
      logger.warn({ workspaceId: ws(req), by: req.user!.id }, 'Carteira Asaas da oficina alterada');
    }
    await mergeSettings(db, ws(req), patch);
    // Nome da oficina aparece na lista do admin geral.
    if (patch.storeName) {
      await db.update(workspaces).set({ name: patch.storeName }).where(eq(workspaces.id, ws(req)));
      bus.emitChange(ws(req), 'workspaces');
    }
    bus.emitChange(ws(req), 'settings');
    res.json(await getSettings(db, ws(req)));
  }));

  return r;
}
