import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { aiSearches } from '../db/schema';
import { requirePermission } from '../auth/middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { newId, type ApiDeps } from './deps';

const aiSearchInput = z.object({
  query: z.string().min(1).max(5000),
  response: z.string().max(100_000),
  metadata: z.unknown().optional(),
});

export function createAiSearchesRouter({ db }: ApiDeps) {
  const r = Router();

  r.get('/ai-searches', requirePermission(), asyncHandler(async (req, res) => {
    res.json(await db.select().from(aiSearches)
      .where(eq(aiSearches.userId, req.user!.id))
      .orderBy(desc(aiSearches.timestamp))
      .limit(50));
  }));

  r.post('/ai-searches', requirePermission(), asyncHandler(async (req, res) => {
    const data = aiSearchInput.parse(req.body);
    const [row] = await db.insert(aiSearches).values({ id: newId(), userId: req.user!.id, ...data }).returning();
    res.status(201).json(row);
  }));

  r.delete('/ai-searches/:id', requirePermission(), asyncHandler(async (req, res) => {
    await db.delete(aiSearches).where(and(eq(aiSearches.id, req.params.id), eq(aiSearches.userId, req.user!.id)));
    res.status(204).end();
  }));

  return r;
}
