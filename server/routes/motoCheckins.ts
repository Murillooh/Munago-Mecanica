import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { motoCheckins, notifications, units } from '../db/schema';
import { effectivePermissions, requirePermission, unitScope, ws } from '../auth/middleware';
import { MAX_ESTIMATE_MINUTES, MOTO_ACTIONS, MOTO_NOTIFY, type MotoAction, type MotoEvent, type MotoStatus } from '../services/motoFlow';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

// Só imagem JPEG/PNG/WebP em data URL (comprimida no navegador). 9 fotos × 200 mil caracteres cabem no limite de 2 MB do JSON.
const photo = z.string().max(200_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Foto inválida.');

const checkinInput = z.object({
  plate: z.string().trim().toUpperCase().min(3).max(10),
  model: z.string().trim().min(1).max(100),
  unitId: z.string().trim().min(1).max(100).optional(),
  km: z.number().int().nonnegative().max(2_000_000),
  notes: z.string().trim().max(2000).optional(),
  photos: z.object({
    front: photo, back: photo, left: photo, right: photo, odometer: photo,
    extra: z.array(photo).max(4).optional(),
  }),
});

const item = z.object({
  code: z.string().trim().max(60).default(''),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(999),
  purpose: z.string().trim().max(200).default(''),
});

const actionInput = z.object({
  action: z.enum(Object.keys(MOTO_ACTIONS) as [MotoAction, ...MotoAction[]]),
  note: z.string().trim().max(1000).optional(),
  /** diagnose: o pedido do mecânico. stock_*: disponibilidade de cada item (mesma ordem). */
  items: z.array(item).min(1).max(50).optional(),
  available: z.array(z.boolean()).max(50).optional(),
  /** diagnose: prazo do serviço em minutos. */
  estimatedMinutes: z.number().int().min(5).max(MAX_ESTIMATE_MINUTES, `O prazo máximo é de ${MAX_ESTIMATE_MINUTES} minutos.`).optional(),
  /** finish: fotos da moto pronta (obrigatórias, com a observação). */
  photos: z.array(photo).min(1).max(6).optional(),
  /** authorize: print ou PDF do e-mail em que o franqueado autoriza (até ~1 MB). */
  proof: z.object({
    name: z.string().trim().min(1).max(200),
    url: z.string().max(1_400_000, 'Comprovante grande demais (máx. 1 MB).').regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/, 'Envie imagem ou PDF.'),
  }).optional(),
});

/** Avisa o setor que precisa agir agora (só na unidade da moto). */
async function notifyNextSector(db: ApiDeps['db'], os: { id: string; workspaceId: string; unitId: string | null; model: string; plate: string; unit: string | null }, status: MotoStatus) {
  const n = MOTO_NOTIFY[status];
  if (!n) return;
  await db.insert(notifications).values({
    id: newId(), workspaceId: os.workspaceId, type: 'moto_os', target: n.target, unitId: os.unitId, refId: os.id,
    title: `${os.model} · ${os.plate}`,
    message: `A moto ${n.text}${os.unit ? ` (${os.unit})` : ''}.`,
  });
}

/** Check-list de recebimento da moto: fotos de todos os lados, painel com o km e observações. */
export function createMotoCheckinsRouter({ db, bus }: ApiDeps) {
  const r = Router();
  const { photos: _photos, ...listColumns } = getTableColumns(motoCheckins);

  // Quem não enxerga todas as unidades vê só os registros da própria.
  const visible = (req: Request) => {
    const scope = unitScope(req.user!);
    return and(eq(motoCheckins.workspaceId, ws(req)), scope ? eq(motoCheckins.unitId, scope) : undefined);
  };

  // Lista sem as fotos (pesadas); a foto vem no GET do item.
  r.get('/moto-checkins', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select(listColumns).from(motoCheckins)
      .where(visible(req)).orderBy(desc(motoCheckins.createdAt)).limit(500));
  }));

  r.get('/moto-checkins/:id', requirePermission(), asyncHandler(async (req, res) => {
    const [row] = await db.select().from(motoCheckins)
      .where(and(visible(req), eq(motoCheckins.id, req.params.id)));
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Check-list não encontrado.');
    res.json(row);
  }));

  r.post('/moto-checkins', requirePermission('canCheckin'), asyncHandler(async (req, res) => {
    const { unitId: wanted, ...data } = checkinInput.parse(req.body);
    // Preso a uma unidade: registra sempre nela. Quem vê todas escolhe (ou deixa sem).
    const scope = unitScope(req.user!);
    const unitId = scope ?? wanted ?? null;
    if (scope && !req.user!.unitId) throw new ApiError(400, 'NO_UNIT', 'Seu usuário não tem unidade. Peça ao administrador.');
    const [unit] = unitId
      ? await db.select().from(units).where(and(eq(units.workspaceId, ws(req)), eq(units.id, unitId)))
      : [];
    if (unitId && !unit) throw new ApiError(400, 'INVALID_UNIT', 'Unidade não encontrada.');
    const received: MotoEvent = { type: 'recebida', at: new Date().toISOString(), by: req.user!.id, byName: req.user!.name, note: data.notes };
    const [row] = await db.insert(motoCheckins).values({
      id: newId(), workspaceId: ws(req), ...data, unitId, unit: unit?.name ?? null, createdBy: req.user!.id, createdByName: req.user!.name,
      events: [received],
    }).returning(listColumns);
    await notifyNextSector(db, row, 'recebida');
    bus.emitChange(ws(req), 'motoCheckins', 'notifications');
    res.status(201).json(row);
  }));

  /** Avança a OS da moto uma etapa (state machine em motoFlow.ts) e registra na linha do tempo. */
  r.post('/moto-checkins/:id/actions', requirePermission(), asyncHandler(async (req, res) => {
    const input = actionInput.parse(req.body);
    const step = MOTO_ACTIONS[input.action];
    if (!effectivePermissions(req.user!)[step.perm]) throw new ApiError(403, 'FORBIDDEN', 'Seu perfil não faz esta etapa.');

    const [current] = await db.select(listColumns).from(motoCheckins).where(and(visible(req), eq(motoCheckins.id, req.params.id)));
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'OS da moto não encontrada.');
    if (!step.from.includes(current.status)) throw new ApiError(409, 'WRONG_STEP', 'A OS não está nesta etapa (talvez alguém já fez). Atualize a tela.');

    let items = current.items;
    if (input.action === 'diagnose') {
      if (!input.items) throw new ApiError(400, 'ITEMS_REQUIRED', 'Informe o que precisa ser feito na moto.');
      if (!input.estimatedMinutes) throw new ApiError(400, 'ESTIMATE_REQUIRED', 'Informe o tempo estimado do serviço.');
      items = input.items;
    }
    if (input.action === 'stock_ok' || input.action === 'stock_missing') {
      if (input.available && input.available.length !== items.length) throw new ApiError(400, 'VALIDATION', 'Confira todos os itens.');
      items = items.map((it, i) => ({ ...it, available: input.action === 'stock_ok' ? true : input.available?.[i] ?? false }));
    }
    if (input.action === 'reject' && !input.note) throw new ApiError(400, 'NOTE_REQUIRED', 'Diga o motivo da recusa.');
    if (input.action === 'finish' && (!input.photos || !input.note)) throw new ApiError(400, 'FINISH_REQUIRES_PROOF', 'Para finalizar, tire as fotos da moto pronta e descreva o que foi feito.');
    if (input.action === 'authorize' && !input.proof) throw new ApiError(400, 'AUTH_REQUIRES_PROOF', 'Anexe o e-mail do franqueado autorizando a manutenção.');

    const event: MotoEvent = { type: input.action, at: new Date().toISOString(), by: req.user!.id, byName: req.user!.name, note: input.note };
    const now = new Date();
    // Só atualiza se ainda estiver na etapa lida: dois cliques/duas pessoas não avançam duas vezes.
    const [row] = await db.update(motoCheckins).set({
      status: step.to,
      items,
      events: sql`${motoCheckins.events} || ${JSON.stringify([event])}::jsonb`,
      updatedAt: now,
      ...(input.action === 'diagnose' ? { estimatedMinutes: input.estimatedMinutes } : {}),
      ...(input.action === 'authorize' ? { photos: sql`${motoCheckins.photos} || ${JSON.stringify({ authProof: input.proof })}::jsonb` } : {}),
      ...(input.action === 'start' ? { startedAt: now } : {}),
      ...(input.action === 'finish' ? { finishedAt: now, photos: sql`${motoCheckins.photos} || ${JSON.stringify({ final: input.photos })}::jsonb` } : {}),
    }).where(and(eq(motoCheckins.id, current.id), inArray(motoCheckins.status, step.from))).returning(listColumns);
    if (!row) throw new ApiError(409, 'WRONG_STEP', 'A OS mudou de etapa enquanto você confirmava. Atualize a tela.');
    // Pedido de autorização só registra na linha do tempo: a etapa (e o setor) não muda.
    if (row.status !== current.status) await notifyNextSector(db, row, row.status);
    bus.emitChange(ws(req), 'motoCheckins', 'notifications');
    res.json(row);
  }));

  return r;
}
