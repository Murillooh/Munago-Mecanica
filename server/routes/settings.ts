import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { settings } from '../db/schema';
import type { DB } from '../db/client';
import { requireAdmin, requirePermission } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import type { ApiDeps } from './deps';

export const DEFAULT_SETTINGS = {
  storeName: 'Munago Estoque',
  allowNegativeStock: false,
  accentColor: '#2563eb',
  autoBackupEnabled: false,
  enableSoundAlerts: true,
  monitorAutoScrollEnabled: true,
  monitorScrollIntervalSeconds: 12,
  /** % do total da OS repassado à empresa no pagamento (o resto é da oficina). Ajustável por OS. */
  companySharePercent: 0,
  lastBackup: '',
};

export type SystemSettings = typeof DEFAULT_SETTINGS & {
  logoUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
};

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
  companySharePercent: z.number().min(0).max(100),
}).partial().strict();

export async function getSettings(db: DB): Promise<SystemSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 'global'));
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) } as SystemSettings;
}

export async function mergeSettings(db: DB, patch: Record<string, unknown>) {
  await db.insert(settings).values({ id: 'global', data: patch })
    .onConflictDoUpdate({
      target: settings.id,
      set: { data: sql`${settings.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: sql`now()` },
    });
}

export function createSettingsRouter({ db, bus }: ApiDeps) {
  const r = Router();

  r.get('/settings', requirePermission(), asyncHandler(async (_req, res) => {
    res.json(await getSettings(db));
  }));

  // Antes qualquer aprovado podia alterar (firestore.rules); agora só admin.
  r.patch('/settings', requireAdmin, asyncHandler(async (req, res) => {
    await mergeSettings(db, settingsPatch.parse(req.body));
    bus.emitChange('settings');
    res.json(await getSettings(db));
  }));

  return r;
}
