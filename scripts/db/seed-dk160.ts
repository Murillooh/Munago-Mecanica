/**
 * Popula o almoxarifado com as peças da Haojue DK 160 (162 cc, injeção eletrônica, refrigeração a ar,
 * disco dianteiro + tambor traseiro CBS, pneus 80/100-18 e 100/80-18).
 *
 * Uso: npx tsx scripts/db/seed-dk160.ts
 * Só roda no banco mecanica_dev (proteção contra popular produção sem querer). Idempotente por SKU.
 * Preço e estoque começam zerados: os SKUs são internos (DK-xxx-nnn), não códigos de fábrica.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '../../server/db/client';
import { categories, products } from '../../server/db/schema';

// Oficina que recebe os dados de teste (padrão: a do admin geral).
const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID ?? 'default';

type Part = [sku: string, name: string, minQuantity: number, description?: string];

const CATALOG: { category: string; description: string; parts: Part[] }[] = [
  {
    category: 'Filtros e Lubrificantes',
    description: 'Itens da revisão periódica (a cada 3.000 km ou 6 meses).',
    parts: [
      ['DK-FIL-001', 'Óleo do motor 4T (1 L)', 12, 'Conferir viscosidade e especificação no manual do proprietário.'],
      ['DK-FIL-002', 'Filtro de óleo', 6],
      ['DK-FIL-003', 'Tela do filtro de óleo', 2],
      ['DK-FIL-004', 'Anel de vedação do bujão de óleo', 10],
      ['DK-FIL-005', 'Elemento do filtro de ar', 4],
      ['DK-FIL-006', 'Filtro de combustível', 3],
      ['DK-FIL-007', 'Lubrificante de corrente (spray)', 4],
      ['DK-FIL-008', 'Fluido de freio DOT 4 (500 ml)', 3],
      ['DK-FIL-009', 'Graxa para rolamentos e articulações', 2],
    ],
  },
  {
    category: 'Motor',
    description: 'Monocilíndrico 4 tempos OHC, 162 cc, refrigerado a ar.',
    parts: [
      ['DK-MOT-001', 'Kit pistão com anéis (STD)', 1],
      ['DK-MOT-002', 'Jogo de anéis do pistão (STD)', 2],
      ['DK-MOT-003', 'Pino e travas do pistão', 1],
      ['DK-MOT-004', 'Cilindro', 1],
      ['DK-MOT-005', 'Junta do cabeçote', 3],
      ['DK-MOT-006', 'Junta da base do cilindro', 3],
      ['DK-MOT-007', 'Jogo completo de juntas do motor', 1],
      ['DK-MOT-008', 'Válvula de admissão', 1],
      ['DK-MOT-009', 'Válvula de escape', 1],
      ['DK-MOT-010', 'Retentor de válvula', 4],
      ['DK-MOT-011', 'Corrente de comando', 1],
      ['DK-MOT-012', 'Tensor da corrente de comando', 1],
      ['DK-MOT-013', 'Guia da corrente de comando', 1],
      ['DK-MOT-014', 'Eixo de comando de válvulas', 1],
      ['DK-MOT-015', 'Balancim', 1],
      ['DK-MOT-016', 'Junta da tampa de válvulas', 3],
      ['DK-MOT-017', 'Retentor do pinhão', 2],
      ['DK-MOT-018', 'Retentor do eixo de câmbio', 2],
      ['DK-MOT-019', 'Junta da tampa lateral direita', 2],
      ['DK-MOT-020', 'Junta da tampa lateral esquerda', 2],
      ['DK-MOT-021', 'Rolamento do virabrequim', 1],
    ],
  },
  {
    category: 'Injeção e Alimentação',
    description: 'Sistema de injeção eletrônica (sem carburador).',
    parts: [
      ['DK-INJ-001', 'Bico injetor', 1],
      ['DK-INJ-002', 'Anel de vedação do bico injetor', 4],
      ['DK-INJ-003', 'Bomba de combustível', 1],
      ['DK-INJ-004', 'Corpo de borboleta (TBI)', 1],
      ['DK-INJ-005', 'Sensor de posição da borboleta (TPS)', 1],
      ['DK-INJ-006', 'Sensor de temperatura do motor', 1],
      ['DK-INJ-007', 'Sensor de oxigênio (sonda lambda)', 1],
      ['DK-INJ-008', 'Mangueira de combustível', 2],
      ['DK-INJ-009', 'Coletor de admissão', 1],
      ['DK-INJ-010', 'Tampa do tanque com chave', 1],
    ],
  },
  {
    category: 'Transmissão',
    description: 'Kit de relação e componentes de câmbio.',
    parts: [
      ['DK-TRA-001', 'Kit relação (corrente, coroa e pinhão)', 3],
      ['DK-TRA-002', 'Corrente de transmissão', 2],
      ['DK-TRA-003', 'Coroa', 2],
      ['DK-TRA-004', 'Pinhão', 2],
      ['DK-TRA-005', 'Cubo da coroa com amortecedores', 1],
      ['DK-TRA-006', 'Borracha do cubo da coroa (jogo)', 2],
      ['DK-TRA-007', 'Guia / protetor da corrente', 1],
      ['DK-TRA-008', 'Esticador da corrente (par)', 2],
      ['DK-TRA-009', 'Pedal de câmbio', 1],
    ],
  },
  {
    category: 'Embreagem',
    description: '',
    parts: [
      ['DK-EMB-001', 'Kit discos de embreagem', 2],
      ['DK-EMB-002', 'Jogo de molas da embreagem', 2],
      ['DK-EMB-003', 'Separadores de embreagem (jogo)', 1],
      ['DK-EMB-004', 'Cabo de embreagem', 3],
      ['DK-EMB-005', 'Manete de embreagem', 2],
    ],
  },
  {
    category: 'Freios',
    description: 'Disco dianteiro e tambor traseiro, com sistema combinado (CBS).',
    parts: [
      ['DK-FRE-001', 'Pastilha de freio dianteira (par)', 6],
      ['DK-FRE-002', 'Disco de freio dianteiro', 1],
      ['DK-FRE-003', 'Sapata / lona de freio traseira (par)', 6],
      ['DK-FRE-004', 'Tambor / cubo traseiro', 1],
      ['DK-FRE-005', 'Mola da sapata de freio traseira', 4],
      ['DK-FRE-006', 'Reparo da pinça de freio dianteira', 2],
      ['DK-FRE-007', 'Reparo do cilindro mestre dianteiro', 2],
      ['DK-FRE-008', 'Mangueira de freio dianteira', 1],
      ['DK-FRE-009', 'Manete de freio dianteiro', 2],
      ['DK-FRE-010', 'Pedal de freio traseiro', 1],
      ['DK-FRE-011', 'Vareta / tirante do freio traseiro', 1],
      ['DK-FRE-012', 'Interruptor do freio (manete)', 2],
      ['DK-FRE-013', 'Interruptor do freio traseiro (pedal)', 2],
    ],
  },
  {
    category: 'Rodas e Pneus',
    description: 'Aro 18 na dianteira e na traseira.',
    parts: [
      ['DK-ROD-001', 'Pneu dianteiro 80/100-18', 2],
      ['DK-ROD-002', 'Pneu traseiro 100/80-18', 2],
      ['DK-ROD-003', 'Câmara de ar dianteira aro 18', 3],
      ['DK-ROD-004', 'Câmara de ar traseira aro 18', 3],
      ['DK-ROD-005', 'Rolamento da roda dianteira', 4],
      ['DK-ROD-006', 'Rolamento da roda traseira', 4],
      ['DK-ROD-007', 'Retentor da roda dianteira', 4],
      ['DK-ROD-008', 'Eixo da roda dianteira', 1],
      ['DK-ROD-009', 'Eixo da roda traseira', 1],
      ['DK-ROD-010', 'Engrenagem / sensor de velocidade', 1],
      ['DK-ROD-011', 'Protetor de aro (fita)', 4],
    ],
  },
  {
    category: 'Suspensão e Direção',
    description: '',
    parts: [
      ['DK-SUS-001', 'Retentor da bengala (par)', 3],
      ['DK-SUS-002', 'Guarda-pó da bengala (par)', 2],
      ['DK-SUS-003', 'Óleo de suspensão (1 L)', 2],
      ['DK-SUS-004', 'Tubo da bengala', 1],
      ['DK-SUS-005', 'Amortecedor traseiro', 1],
      ['DK-SUS-006', 'Caixa de direção (rolamentos)', 2],
      ['DK-SUS-007', 'Bucha da balança traseira', 2],
      ['DK-SUS-008', 'Guidão', 1],
      ['DK-SUS-009', 'Manopla (par)', 3],
    ],
  },
  {
    category: 'Elétrica e Ignição',
    description: '',
    parts: [
      ['DK-ELE-001', 'Vela de ignição', 8, 'Conferir código e grau térmico no manual.'],
      ['DK-ELE-002', 'Cachimbo da vela', 2],
      ['DK-ELE-003', 'Bobina de ignição', 1],
      ['DK-ELE-004', 'Bateria 12 V selada', 2],
      ['DK-ELE-005', 'Regulador retificador', 1],
      ['DK-ELE-006', 'Estator (bobina do alternador)', 1],
      ['DK-ELE-007', 'Sensor de rotação (pick-up)', 1],
      ['DK-ELE-008', 'Motor de partida', 1],
      ['DK-ELE-009', 'Relé de partida', 2],
      ['DK-ELE-010', 'Relé do pisca', 2],
      ['DK-ELE-011', 'Fusível 10 A', 10],
      ['DK-ELE-012', 'Fusível 15 A', 10],
      ['DK-ELE-013', 'Chave de ignição com trava', 1],
      ['DK-ELE-014', 'Interruptor do descanso lateral', 2],
      ['DK-ELE-015', 'Interruptor de ponto morto (neutro)', 1],
      ['DK-ELE-016', 'Sensor do nível de combustível (boia)', 1],
      ['DK-ELE-017', 'Buzina', 1],
      ['DK-ELE-018', 'Chicote elétrico principal', 1],
      ['DK-ELE-019', 'Módulo de injeção (ECU)', 1],
      ['DK-ELE-020', 'Punho de comandos esquerdo', 1],
      ['DK-ELE-021', 'Punho de comandos direito (partida)', 1],
    ],
  },
  {
    category: 'Iluminação e Sinalização',
    description: '',
    parts: [
      ['DK-ILU-001', 'Lâmpada do farol', 4],
      ['DK-ILU-002', 'Lâmpada da lanterna / freio', 6],
      ['DK-ILU-003', 'Lâmpada do pisca', 8],
      ['DK-ILU-004', 'Pisca dianteiro', 2],
      ['DK-ILU-005', 'Pisca traseiro', 2],
      ['DK-ILU-006', 'Lanterna traseira', 1],
      ['DK-ILU-007', 'Bloco óptico do farol', 1],
      ['DK-ILU-008', 'Iluminação da placa', 1],
      ['DK-ILU-009', 'Painel de instrumentos', 1],
    ],
  },
  {
    category: 'Cabos e Comandos',
    description: '',
    parts: [
      ['DK-CAB-001', 'Cabo do acelerador', 3],
      ['DK-CAB-002', 'Cabo do velocímetro / sensor', 1],
      ['DK-CAB-003', 'Acelerador (punho rotativo)', 1],
      ['DK-CAB-004', 'Pedaleira dianteira (par)', 2],
      ['DK-CAB-005', 'Borracha da pedaleira', 4],
      ['DK-CAB-006', 'Espelho retrovisor esquerdo', 2],
      ['DK-CAB-007', 'Espelho retrovisor direito', 2],
    ],
  },
  {
    category: 'Carenagem e Chassi',
    description: '',
    parts: [
      ['DK-CAR-001', 'Para-lama dianteiro', 1],
      ['DK-CAR-002', 'Para-lama traseiro', 1],
      ['DK-CAR-003', 'Tampa lateral esquerda', 1],
      ['DK-CAR-004', 'Tampa lateral direita', 1],
      ['DK-CAR-005', 'Aba do tanque (par)', 1],
      ['DK-CAR-006', 'Banco', 1],
      ['DK-CAR-007', 'Suporte da placa', 1],
      ['DK-CAR-008', 'Descanso lateral', 1],
      ['DK-CAR-009', 'Mola do descanso lateral', 3],
      ['DK-CAR-010', 'Cavalete central', 1],
      ['DK-CAR-011', 'Bagageiro / alça do garupa', 1],
    ],
  },
  {
    category: 'Escapamento',
    description: '',
    parts: [
      ['DK-ESC-001', 'Junta do escapamento', 6],
      ['DK-ESC-002', 'Silencioso / ponteira', 1],
      ['DK-ESC-003', 'Protetor de calor do escapamento', 1],
      ['DK-ESC-004', 'Prisioneiro e porca do escapamento', 4],
    ],
  },
  {
    category: 'Fixação e Diversos',
    description: 'Parafusaria e itens de reposição rápida.',
    parts: [
      ['DK-FIX-001', 'Kit parafusos da carenagem', 2],
      ['DK-FIX-002', 'Porca do eixo traseiro', 4],
      ['DK-FIX-003', 'Contrapino', 20],
      ['DK-FIX-004', 'Abraçadeira plástica (pacote)', 3],
      ['DK-FIX-005', 'Parafuso de disco de freio (jogo)', 2],
    ],
  },
];

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.pathname !== '/mecanica_dev' && !process.argv.includes('--force')) {
    console.error(`Recusado: DATABASE_URL aponta para "${url.pathname.slice(1)}", não para mecanica_dev. Use --force se for intencional.`);
    process.exit(1);
  }

  const db = createDb();
  const existingCats = new Set((await db.select({ name: categories.name }).from(categories).where(eq(categories.workspaceId, WORKSPACE_ID))).map((c) => c.name));
  const newCats = CATALOG.filter((c) => !existingCats.has(c.category));
  if (newCats.length) {
    await db.insert(categories).values(newCats.map((c) => ({ id: randomUUID(), workspaceId: WORKSPACE_ID, name: c.category, description: c.description || null })));
  }

  const allSkus = CATALOG.flatMap((c) => c.parts.map((p) => p[0]));
  const existingSkus = new Set((await db.select({ sku: products.sku }).from(products).where(and(eq(products.workspaceId, WORKSPACE_ID), inArray(products.sku, allSkus)))).map((p) => p.sku));
  const rows = CATALOG.flatMap((c) =>
    c.parts
      .filter(([sku]) => !existingSkus.has(sku))
      .map(([sku, name, minQuantity, description]) => ({
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        sku,
        name,
        category: c.category,
        description: description ?? null,
        minQuantity,
        quantity: 0,
        observation: 'Haojue DK 160. Conferir o código original antes da compra.',
      })),
  );
  if (rows.length) await db.insert(products).values(rows);

  console.log(`Categorias novas: ${newCats.length} | Peças novas: ${rows.length} (de ${allSkus.length} no catálogo).`);
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
