import { describe, it, expect } from 'vitest';
import { createTestDb } from '../test/testDb';
import { products, serviceOrders } from './schema';

describe('schema', () => {
  it('aplica migrações e devolve numeric/jsonb como tipos JS', async () => {
    const db = await createTestDb();
    const [p] = await db.insert(products)
      .values({ id: 'p1', workspaceId: 'default', name: 'Filtro de óleo', quantity: 5, minQuantity: 2, price: 39.9 })
      .returning();
    expect(p).toMatchObject({ price: 39.9, status: 'ativo' });
    expect(p.createdAt).toBeInstanceOf(Date);

    const [os] = await db.insert(serviceOrders).values({
      id: 'os1', workspaceId: 'default', customerName: 'João', scheduledDate: '2026-10-05', createdBy: 'u1',
      items: [{ productId: 'p1', name: 'Filtro', quantity: 1, price: 39.9, laborCost: 20, total: 59.9 }],
      totalAmount: 59.9,
    }).returning();
    expect(os.items[0].total).toBe(59.9);
    expect(os.totalAmount).toBe(59.9);
  });
});
