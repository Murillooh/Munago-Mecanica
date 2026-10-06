/**
 * Lança uma entrada de "estoque inicial (teste)" nas peças da DK 160 que estão zeradas,
 * com quantidade igual ao estoque mínimo. Gera a movimentação no histórico, como uma entrada real.
 *
 * Uso: npx tsx scripts/db/stock-dk160.ts
 * Só roda no mecanica_dev e só mexe em peças DK-* com quantidade 0 (não duplica se rodar de novo).
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, like } from 'drizzle-orm';
import { createDb } from '../../server/db/client';
import { products, transactions, users } from '../../server/db/schema';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.pathname !== '/mecanica_dev' && !process.argv.includes('--force')) {
    console.error(`Recusado: DATABASE_URL aponta para "${url.pathname.slice(1)}", não para mecanica_dev. Use --force se for intencional.`);
    process.exit(1);
  }

  const db = createDb();
  const [admin] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (!admin) throw new Error('Nenhum admin no banco: faça login uma vez no localhost antes de rodar.');

  const zeroed = await db
    .select({ id: products.id, name: products.name, minQuantity: products.minQuantity })
    .from(products)
    .where(and(like(products.sku, 'DK-%'), eq(products.quantity, 0)));
  const toStock = zeroed.filter((p) => p.minQuantity > 0);

  await db.transaction(async (tx) => {
    for (const p of toStock) {
      await tx.update(products).set({ quantity: p.minQuantity, updatedAt: new Date() }).where(eq(products.id, p.id));
    }
    if (toStock.length) {
      await tx.insert(transactions).values(toStock.map((p) => ({
        id: randomUUID(),
        productId: p.id,
        productName: p.name,
        type: 'in' as const,
        quantity: p.minQuantity,
        reason: 'Estoque inicial (teste)',
        userId: admin.id,
        userName: admin.name,
      })));
    }
  });

  console.log(`Entradas lançadas: ${toStock.length} peças (usuário: ${admin.name}).`);
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
