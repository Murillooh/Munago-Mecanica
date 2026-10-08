import { desc, eq } from 'drizzle-orm';
import { backups, categories, products, serviceOrders, transactions, workspaces } from '../db/schema';
import type { DB } from '../db/client';
import { getSettings, mergeSettings } from '../routes/settings';
import { newId } from '../routes/deps';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Backup lógico diário no próprio banco (antes rodava no navegador do admin), uma vez por oficina.
 * O RDS também tem backup automático; este guarda um retrato legível dos dados.
 * Devolve true se ao menos uma oficina teve backup criado.
 */
export async function runAutoBackupIfDue(db: DB, now = new Date()): Promise<boolean> {
  const all = await db.select({ id: workspaces.id }).from(workspaces);
  let any = false;
  for (const w of all) any = (await backupWorkspaceIfDue(db, w.id, now)) || any;
  return any;
}

async function backupWorkspaceIfDue(db: DB, workspaceId: string, now: Date): Promise<boolean> {
  const s = await getSettings(db, workspaceId);
  if (!s.autoBackupEnabled) return false;
  const last = s.lastBackup ? new Date(s.lastBackup).getTime() : 0;
  if (now.getTime() - last < DAY_MS) return false;

  const [prods, cats, txs, oss] = await Promise.all([
    db.select().from(products).where(eq(products.workspaceId, workspaceId)),
    db.select().from(categories).where(eq(categories.workspaceId, workspaceId)),
    db.select().from(transactions).where(eq(transactions.workspaceId, workspaceId))
      .orderBy(desc(transactions.timestamp)).limit(100),
    db.select().from(serviceOrders).where(eq(serviceOrders.workspaceId, workspaceId))
      .orderBy(desc(serviceOrders.createdAt)).limit(50),
  ]);

  await db.insert(backups).values({
    id: newId(),
    workspaceId,
    productCount: prods.length,
    transactionCount: txs.length,
    categoryCount: cats.length,
    serviceOrderCount: oss.length,
    data: { products: prods, categories: cats, transactions: txs, serviceOrders: oss },
    timestamp: now,
  });
  await mergeSettings(db, workspaceId, { lastBackup: now.toISOString() });
  return true;
}
