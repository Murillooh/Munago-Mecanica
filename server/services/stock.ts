import { and, eq, sql } from 'drizzle-orm';
import { notifications, products, transactions } from '../db/schema';
import { ApiError } from '../middleware/errorHandler';
import { newId, type Tx } from '../routes/deps';

export interface Movement {
  workspaceId: string;
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  reason?: string | null;
  userId: string;
  userName: string;
}

/**
 * Movimenta estoque dentro de uma transação SQL: trava a linha do produto (FOR UPDATE),
 * valida saldo, grava o histórico e cria alerta de estoque baixo (sem duplicar não lidos).
 */
export async function applyMovement(tx: Tx, m: Movement, allowNegative: boolean) {
  // Produto de outra oficina conta como inexistente.
  const [p] = await tx.select().from(products)
    .where(and(eq(products.workspaceId, m.workspaceId), eq(products.id, m.productId))).for('update');
  if (!p) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');

  const newQty = p.quantity + (m.type === 'in' ? m.quantity : -m.quantity);
  if (newQty < 0 && !allowNegative) {
    throw new ApiError(400, 'INSUFFICIENT_STOCK', `Estoque insuficiente para o item: ${p.name}`);
  }

  await tx.update(products).set({ quantity: newQty, updatedAt: sql`now()` }).where(eq(products.id, p.id));
  await tx.insert(transactions).values({
    id: newId(),
    workspaceId: p.workspaceId,
    productId: p.id,
    productName: p.name,
    type: m.type,
    quantity: m.quantity,
    reason: m.reason ?? null,
    userId: m.userId,
    userName: m.userName,
  });

  const lowStock = newQty <= p.minQuantity;
  let notified = false;
  if (lowStock) {
    const [existing] = await tx.select({ id: notifications.id }).from(notifications).where(and(
      eq(notifications.productId, p.id),
      eq(notifications.read, false),
      eq(notifications.type, 'low_stock'),
    ));
    if (!existing) {
      await tx.insert(notifications).values({
        id: newId(),
        workspaceId: p.workspaceId,
        title: 'Alerta de Estoque Baixo',
        message: `O produto "${p.name}" atingiu o nível crítico (${newQty} unidades).`,
        productId: p.id,
        type: 'low_stock',
      });
      notified = true;
    }
  }
  return { newQty, lowStock, notified };
}
