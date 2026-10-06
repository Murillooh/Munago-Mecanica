import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../db/schema';
import { CHANGES_CHANNEL } from './pgListener';

describe('triggers de tempo real (0001_realtime_notify)', () => {
  it('avisam o recurso certo, uma vez por comando', async () => {
    const pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    await migrate(db, { migrationsFolder: 'server/db/migrations' });

    const got: string[] = [];
    await pglite.listen(CHANGES_CHANNEL, (payload) => got.push(payload));

    await db.insert(schema.products).values([
      { id: 'p1', name: 'Pastilha' },
      { id: 'p2', name: 'Vela' },
    ]);
    await db.insert(schema.serviceOrders).values({ id: 'os1', customerName: 'Ana', scheduledDate: '2026-10-06', createdBy: 'u1' });
    await new Promise((r) => setTimeout(r, 50));

    expect(got).toEqual(['products', 'serviceOrders']);
    await pglite.close();
  });
});
