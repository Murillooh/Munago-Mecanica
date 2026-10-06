/**
 * Preenche o preço das peças da DK 160 criadas por seed-dk160.ts com valores de referência
 * do mercado de reposição (street 160 cc, out/2026). São ESTIMATIVAS: confirmar com o fornecedor.
 *
 * Uso: npx tsx scripts/db/price-dk160.ts
 * Só roda no mecanica_dev e só altera peças com preço vazio (não sobrescreve ajuste manual).
 */
import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '../../server/db/client';
import { products } from '../../server/db/schema';

const PRICES: Record<string, number> = {
  // Filtros e Lubrificantes
  'DK-FIL-001': 35, 'DK-FIL-002': 25, 'DK-FIL-003': 18, 'DK-FIL-004': 3, 'DK-FIL-005': 45,
  'DK-FIL-006': 35, 'DK-FIL-007': 40, 'DK-FIL-008': 30, 'DK-FIL-009': 25,
  // Motor
  'DK-MOT-001': 180, 'DK-MOT-002': 70, 'DK-MOT-003': 30, 'DK-MOT-004': 350, 'DK-MOT-005': 25,
  'DK-MOT-006': 12, 'DK-MOT-007': 90, 'DK-MOT-008': 45, 'DK-MOT-009': 50, 'DK-MOT-010': 8,
  'DK-MOT-011': 70, 'DK-MOT-012': 60, 'DK-MOT-013': 35, 'DK-MOT-014': 160, 'DK-MOT-015': 55,
  'DK-MOT-016': 20, 'DK-MOT-017': 12, 'DK-MOT-018': 12, 'DK-MOT-019': 18, 'DK-MOT-020': 18,
  'DK-MOT-021': 70,
  // Injeção e Alimentação
  'DK-INJ-001': 250, 'DK-INJ-002': 8, 'DK-INJ-003': 380, 'DK-INJ-004': 650, 'DK-INJ-005': 180,
  'DK-INJ-006': 90, 'DK-INJ-007': 280, 'DK-INJ-008': 25, 'DK-INJ-009': 80, 'DK-INJ-010': 120,
  // Transmissão
  'DK-TRA-001': 190, 'DK-TRA-002': 110, 'DK-TRA-003': 60, 'DK-TRA-004': 30, 'DK-TRA-005': 140,
  'DK-TRA-006': 35, 'DK-TRA-007': 40, 'DK-TRA-008': 30, 'DK-TRA-009': 45,
  // Embreagem
  'DK-EMB-001': 110, 'DK-EMB-002': 30, 'DK-EMB-003': 70, 'DK-EMB-004': 30, 'DK-EMB-005': 25,
  // Freios
  'DK-FRE-001': 35, 'DK-FRE-002': 160, 'DK-FRE-003': 40, 'DK-FRE-004': 220, 'DK-FRE-005': 8,
  'DK-FRE-006': 45, 'DK-FRE-007': 45, 'DK-FRE-008': 70, 'DK-FRE-009': 30, 'DK-FRE-010': 60,
  'DK-FRE-011': 30, 'DK-FRE-012': 20, 'DK-FRE-013': 22,
  // Rodas e Pneus
  'DK-ROD-001': 230, 'DK-ROD-002': 280, 'DK-ROD-003': 40, 'DK-ROD-004': 45, 'DK-ROD-005': 25,
  'DK-ROD-006': 25, 'DK-ROD-007': 10, 'DK-ROD-008': 45, 'DK-ROD-009': 55, 'DK-ROD-010': 90,
  'DK-ROD-011': 12,
  // Suspensão e Direção
  'DK-SUS-001': 40, 'DK-SUS-002': 35, 'DK-SUS-003': 40, 'DK-SUS-004': 220, 'DK-SUS-005': 260,
  'DK-SUS-006': 70, 'DK-SUS-007': 35, 'DK-SUS-008': 110, 'DK-SUS-009': 30,
  // Elétrica e Ignição
  'DK-ELE-001': 25, 'DK-ELE-002': 20, 'DK-ELE-003': 120, 'DK-ELE-004': 230, 'DK-ELE-005': 150,
  'DK-ELE-006': 280, 'DK-ELE-007': 90, 'DK-ELE-008': 320, 'DK-ELE-009': 45, 'DK-ELE-010': 25,
  'DK-ELE-011': 2, 'DK-ELE-012': 2, 'DK-ELE-013': 180, 'DK-ELE-014': 40, 'DK-ELE-015': 35,
  'DK-ELE-016': 110, 'DK-ELE-017': 35, 'DK-ELE-018': 450, 'DK-ELE-019': 900, 'DK-ELE-020': 120,
  'DK-ELE-021': 110,
  // Iluminação e Sinalização
  'DK-ILU-001': 18, 'DK-ILU-002': 6, 'DK-ILU-003': 4, 'DK-ILU-004': 35, 'DK-ILU-005': 35,
  'DK-ILU-006': 120, 'DK-ILU-007': 180, 'DK-ILU-008': 25, 'DK-ILU-009': 450,
  // Cabos e Comandos
  'DK-CAB-001': 28, 'DK-CAB-002': 25, 'DK-CAB-003': 55, 'DK-CAB-004': 60, 'DK-CAB-005': 12,
  'DK-CAB-006': 30, 'DK-CAB-007': 30,
  // Carenagem e Chassi
  'DK-CAR-001': 150, 'DK-CAR-002': 130, 'DK-CAR-003': 90, 'DK-CAR-004': 90, 'DK-CAR-005': 220,
  'DK-CAR-006': 280, 'DK-CAR-007': 60, 'DK-CAR-008': 70, 'DK-CAR-009': 10, 'DK-CAR-010': 140,
  'DK-CAR-011': 160,
  // Escapamento
  'DK-ESC-001': 6, 'DK-ESC-002': 450, 'DK-ESC-003': 80, 'DK-ESC-004': 12,
  // Fixação e Diversos
  'DK-FIX-001': 35, 'DK-FIX-002': 6, 'DK-FIX-003': 1, 'DK-FIX-004': 15, 'DK-FIX-005': 25,
};

const NOTE = 'Haojue DK 160. Preço estimado (referência de mercado, out/2026): confirmar com o fornecedor e conferir o código original antes da compra.';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (url.pathname !== '/mecanica_dev' && !process.argv.includes('--force')) {
    console.error(`Recusado: DATABASE_URL aponta para "${url.pathname.slice(1)}", não para mecanica_dev. Use --force se for intencional.`);
    process.exit(1);
  }

  const db = createDb();
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const [sku, price] of Object.entries(PRICES)) {
      const rows = await tx
        .update(products)
        .set({ price, observation: NOTE, updatedAt: new Date() })
        .where(and(eq(products.sku, sku), isNull(products.price)))
        .returning({ id: products.id });
      updated += rows.length;
    }
  });
  console.log(`Preços preenchidos: ${updated} de ${Object.keys(PRICES).length} peças.`);
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
