/**
 * Cria ordens de serviço de teste para a frota de Haojue DK 160, usando as peças do almoxarifado.
 * Segue o mesmo caminho da API: cada item baixa estoque (applyMovement) e pode gerar alerta de estoque baixo.
 * As datas ficam espalhadas nos últimos 30 dias para os gráficos do monitoramento terem histórico.
 *
 * Uso: npx tsx scripts/db/seed-os-dk160.ts   (depois de seed-dk160, price-dk160 e stock-dk160)
 * Só roda no mecanica_dev. Idempotente: OS de teste são marcadas e não são recriadas.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../../server/db/client';
import { products, serviceOrders, transactions, users } from '../../server/db/schema';
import { applyMovement } from '../../server/services/stock';
import { getSettings } from '../../server/routes/settings';

// Oficina que recebe os dados de teste (padrão: a do admin geral).
const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID ?? 'default';

const TAG = '[teste DK160]';

type Status = 'draft' | 'in_progress' | 'completed' | 'paid';
interface Seed {
  daysAgo: number;
  status: Status;
  customer: string;
  phone: string;
  plate: string;
  generalLabor: number;
  observations: string;
  items: [sku: string, qty: number, labor: number][];
}

const ORDERS: Seed[] = [
  { daysAgo: 28, status: 'paid', customer: 'Carlos Henrique (entregas)', phone: '(11) 90000-0101', plate: 'FRT1A01', generalLabor: 60,
    observations: 'Revisão de 3.000 km.', items: [['DK-FIL-001', 1, 0], ['DK-FIL-002', 1, 15], ['DK-FIL-004', 1, 0]] },
  { daysAgo: 24, status: 'paid', customer: 'Jéssica Moura (entregas)', phone: '(11) 90000-0102', plate: 'FRT1A02', generalLabor: 0,
    observations: 'Corrente com folga e ruído; coroa com dentes gastos.', items: [['DK-TRA-001', 1, 60], ['DK-FIL-007', 1, 0]] },
  { daysAgo: 20, status: 'paid', customer: 'Rafael Antunes (vendas)', phone: '(11) 90000-0103', plate: 'FRT1A03', generalLabor: 0,
    observations: 'Freio dianteiro chiando; traseiro com curso longo.', items: [['DK-FRE-001', 1, 35], ['DK-FRE-003', 1, 40], ['DK-FIL-008', 1, 15]] },
  { daysAgo: 15, status: 'paid', customer: 'Carlos Henrique (entregas)', phone: '(11) 90000-0101', plate: 'FRT1A01', generalLabor: 0,
    observations: 'Pneu traseiro no TWI, furo recorrente na câmara.', items: [['DK-ROD-002', 1, 40], ['DK-ROD-004', 1, 0]] },
  { daysAgo: 11, status: 'completed', customer: 'Marcos Lima (entregas)', phone: '(11) 90000-0104', plate: 'FRT1A04', generalLabor: 40,
    observations: 'Não dava partida pela manhã. Bateria com 11,2 V em repouso; relé de partida intermitente.', items: [['DK-ELE-004', 1, 20], ['DK-ELE-009', 1, 25]] },
  { daysAgo: 8, status: 'completed', customer: 'Jéssica Moura (entregas)', phone: '(11) 90000-0102', plate: 'FRT1A02', generalLabor: 80,
    observations: 'Revisão de 6.000 km.', items: [['DK-FIL-001', 1, 0], ['DK-FIL-002', 1, 15], ['DK-FIL-005', 1, 15], ['DK-ELE-001', 1, 15]] },
  { daysAgo: 5, status: 'in_progress', customer: 'Rafael Antunes (vendas)', phone: '(11) 90000-0103', plate: 'FRT1A03', generalLabor: 0,
    observations: 'Embreagem patinando em subida com garupa.', items: [['DK-EMB-001', 1, 90], ['DK-EMB-002', 1, 0], ['DK-EMB-004', 1, 15]] },
  { daysAgo: 3, status: 'in_progress', customer: 'Patrícia Souza (administrativo)', phone: '(11) 90000-0105', plate: 'FRT1A05', generalLabor: 50,
    observations: 'Falhando em baixa rotação e luz de injeção acesa. Scanner: falha no bico.', items: [['DK-INJ-001', 1, 60], ['DK-INJ-002', 1, 0], ['DK-FIL-006', 1, 20]] },
  { daysAgo: 1, status: 'draft', customer: 'Marcos Lima (entregas)', phone: '(11) 90000-0104', plate: 'FRT1A04', generalLabor: 0,
    observations: 'Bengala esquerda vazando óleo. Orçamento aguardando aprovação.', items: [['DK-SUS-001', 1, 120], ['DK-SUS-003', 1, 0], ['DK-SUS-002', 1, 0]] },
  { daysAgo: 0, status: 'draft', customer: 'Patrícia Souza (administrativo)', phone: '(11) 90000-0105', plate: 'FRT1A05', generalLabor: 0,
    observations: 'Farol baixo queimado e pisca traseiro direito quebrado.', items: [['DK-ILU-001', 1, 10], ['DK-ILU-005', 1, 15]] },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function dateAgo(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d;
}

/** Formato do input datetime-local usado pela tela (YYYY-MM-DDTHH:mm, horário local). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.pathname !== '/mecanica_dev' && !process.argv.includes('--force')) {
    console.error(`Recusado: DATABASE_URL aponta para "${url.pathname.slice(1)}", não para mecanica_dev. Use --force se for intencional.`);
    process.exit(1);
  }

  const db = createDb();
  const existing = await db.select({ id: serviceOrders.id }).from(serviceOrders)
    .where(and(eq(serviceOrders.workspaceId, WORKSPACE_ID), like(serviceOrders.observations, `${TAG}%`)));
  if (existing.length) {
    console.log(`Já existem ${existing.length} OS de teste; nada a fazer.`);
    await db.$client.end();
    return;
  }

  const [admin] = await db.select({ id: users.id, name: users.name }).from(users)
    .where(and(eq(users.workspaceId, WORKSPACE_ID), eq(users.role, 'admin'))).limit(1);
  if (!admin) throw new Error('Nenhum admin no banco: faça login uma vez no localhost antes de rodar.');

  const skus = [...new Set(ORDERS.flatMap((o) => o.items.map((i) => i[0])))];
  const parts = new Map((await db.select().from(products).where(and(eq(products.workspaceId, WORKSPACE_ID), inArray(products.sku, skus)))).map((p) => [p.sku!, p]));
  const missing = skus.filter((s) => !parts.has(s));
  if (missing.length) throw new Error(`Peças não encontradas (rode seed-dk160 antes): ${missing.join(', ')}`);

  const { allowNegativeStock } = await getSettings(db, WORKSPACE_ID);
  let created = 0;

  for (const o of ORDERS) {
    const id = randomUUID();
    const opened = dateAgo(o.daysAgo, 8 + (created % 9));
    const items = o.items.map(([sku, quantity, laborCost]) => {
      const p = parts.get(sku)!;
      const price = p.price ?? 0;
      return { productId: p.id, name: p.name, quantity, price, laborCost, total: round2(quantity * (price + laborCost)) };
    });
    const totalPartsCost = round2(items.reduce((a, i) => a + i.price * i.quantity, 0));
    const totalLaborCost = round2(items.reduce((a, i) => a + i.laborCost * i.quantity, 0) + o.generalLabor);
    const reason = `Ordem de Serviço #${id.slice(-6).toUpperCase()}`;

    await db.transaction(async (tx) => {
      await tx.insert(serviceOrders).values({
        id,
        workspaceId: WORKSPACE_ID,
        customerName: o.customer,
        customerPhone: o.phone,
        vehicleModel: 'Haojue DK 160',
        vehiclePlate: o.plate,
        items,
        generalLaborCost: o.generalLabor,
        totalLaborCost,
        totalPartsCost,
        totalAmount: round2(totalPartsCost + totalLaborCost),
        status: o.status,
        scheduledDate: toLocalInput(opened),
        completionDate: o.status === 'completed' || o.status === 'paid' ? toLocalInput(dateAgo(Math.max(o.daysAgo - 1, 0), 17)) : null,
        observations: `${TAG} ${o.observations}`,
        createdBy: admin.id,
        createdAt: opened,
        updatedAt: opened,
      });
      for (const item of items) {
        await applyMovement(tx, { workspaceId: WORKSPACE_ID, productId: item.productId, type: 'out', quantity: item.quantity, reason, userId: admin.id, userName: admin.name }, allowNegativeStock);
      }
      // Baixa com a data da OS, para o histórico e os gráficos ficarem coerentes.
      await tx.update(transactions).set({ timestamp: opened }).where(eq(transactions.reason, reason));
    });
    created++;
  }

  console.log(`OS de teste criadas: ${created} (estoque baixado pelas peças usadas).`);
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
