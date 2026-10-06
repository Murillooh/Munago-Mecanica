import { desc } from 'drizzle-orm';
import { backups, categories, products, serviceOrders, transactions } from '../db/schema';
import type { DB } from '../db/client';
import { getSettings, mergeSettings } from '../routes/settings';
import { newId } from '../routes/deps';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Backup lógico diário no próprio banco (antes rodava no navegador do admin).
 * O RDS também tem backup automático; este guarda um retrato legível dos dados.
 */
export async function runAutoBackupIfDue(db: DB, now = new Date()): Promise<boolean> {
  const s = await getSettings(db);
  if (!s.autoBackupEnabled) return false;
  const last = s.lastBackup ? new Date(s.lastBackup).getTime() : 0;
  if (now.getTime() - last < DAY_MS) return false;

  const [prods, cats, txs, oss] = await Promise.all([
    db.select().from(products),
    db.select().from(categories),
    db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(100),
    db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt)).limit(50),
  ]);

  await db.insert(backups).values({
    id: newId(),
    productCount: prods.length,
    transactionCount: txs.length,
    categoryCount: cats.length,
    serviceOrderCount: oss.length,
    data: { products: prods, categories: cats, transactions: txs, serviceOrders: oss },
    timestamp: now,
  });
  await mergeSettings(db, { lastBackup: now.toISOString() });
  return true;
}
