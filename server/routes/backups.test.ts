import { describe, it, expect, beforeEach } from 'vitest';
import { createHarness } from '../test/apiHarness';
import { backups, categories, products } from '../db/schema';
import { runAutoBackupIfDue } from '../services/backup';
import { getSettings, mergeSettings } from './settings';

type H = Awaited<ReturnType<typeof createHarness>>;

describe('backups', () => {
  let h: H;
  beforeEach(async () => { h = await createHarness(); });

  it('restore faz upsert por id de produtos e categorias (só admin)', async () => {
    const existing = (await h.as('editor').post('/products', { name: 'Velho', quantity: 1, minQuantity: 0 })).body;
    const payload = {
      products: [
        { id: existing.id, name: 'Restaurado', quantity: 9, minQuantity: 1, status: 'ativo', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'novo-1', name: 'Novo', quantity: 2, minQuantity: 0 },
      ],
      categories: [{ id: 'cat-1', name: 'Filtros' }],
    };
    await h.as('editor').post('/backups/restore', payload).expect(403);
    const res = await h.as('admin').post('/backups/restore', payload).expect(200);
    expect(res.body).toEqual({ products: 2, categories: 1 });

    const rows = await h.db.select().from(products);
    expect(rows.map((p) => [p.name, p.quantity]).sort()).toEqual([['Novo', 2], ['Restaurado', 9]]);
    expect(await h.db.select().from(categories)).toHaveLength(1);
    expect(h.changes).toEqual(expect.arrayContaining(['products', 'categories']));
  });

  it('backup automático: só quando ligado e após 24h', async () => {
    await h.as('editor').post('/products', { name: 'A', quantity: 1, minQuantity: 0 });
    const now = new Date('2026-10-06T12:00:00Z');

    expect(await runAutoBackupIfDue(h.db, now)).toBe(false); // desligado
    await mergeSettings(h.db, 'default', { autoBackupEnabled: true });
    expect(await runAutoBackupIfDue(h.db, now)).toBe(true);
    expect((await getSettings(h.db, 'default')).lastBackup).toBe(now.toISOString());

    expect(await runAutoBackupIfDue(h.db, new Date('2026-10-07T11:00:00Z'))).toBe(false); // < 24h
    expect(await runAutoBackupIfDue(h.db, new Date('2026-10-07T12:30:00Z'))).toBe(true);

    const all = await h.db.select().from(backups);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ productCount: 1 });
  });
});
