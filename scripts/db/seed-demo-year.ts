/**
 * Popula o banco LOCAL com 1 ano de operação fictícia de uma oficina (para demonstração):
 * equipe, peças, serviços, ~1 ano de OS, movimentações de estoque, alertas e pedidos de acesso.
 *
 * Uso: npx tsx scripts/db/seed-demo-year.ts
 * Só roda com DATABASE_URL apontando para localhost (nunca popula RDS/produção).
 * Recria a oficina "demo-munago" do zero a cada execução. O admin geral (1º e-mail de
 * BOOTSTRAP_ADMIN_EMAILS) é colocado nela: ao entrar com esse e-mail, cai direto na oficina demo.
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../../server/db/client';
import {
  accessRequests, categories, motoCheckins, notifications, products, serviceOrders, services, settings, transactions, users, workspaces,
  type ServiceOrderItem, type ServiceOrderService,
} from '../../server/db/schema';
import { PROFILES, type Profile } from '../../server/auth/profiles';
import { MOTO_NOTIFY, type MotoEvent, type MotoItem, type MotoStatus } from '../../server/services/motoFlow';
import { DEFAULT_SETTINGS } from '../../server/routes/settings';
import { freezeSplit, serviceRepasse } from '../../server/services/revenueSplit';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error('Recusado: DATABASE_URL não é local. Este script só popula banco em localhost.');
  process.exit(1);
}
const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAILS ?? '').split(',')[0]?.trim().toLowerCase();
if (!adminEmail) {
  console.error('Defina BOOTSTRAP_ADMIN_EMAILS no .env (o admin entra na oficina demo).');
  process.exit(1);
}

const WS = 'demo-base-centro';
/** Segunda Base, isolada: equipe própria e nenhum dado da primeira. */
const WS2 = 'demo-base-caninde';
const MIN_PERCENT = 10;

// Aleatório com semente: rodar de novo gera os mesmos dados.
let seed = 20261113;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
let idn = 0;
const id = (p: string) => `${p}-${(++idn).toString(36).padStart(6, '0')}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);

const NOW = new Date();
// Dias contados da meia-noite: as horas das OS caem no expediente (8h-16h), não a partir da hora atual.
const START = new Date(NOW); START.setHours(0, 0, 0, 0); START.setDate(START.getDate() - 365);

// ---------------------------------------------------------------- equipe
// Um de cada perfil (o admin é você); Pedro ainda aguarda aprovação
const TEAM: { id: string; email: string; name: string; profile: Profile; ws: string; status: 'approved' | 'pending' }[] = [
  { id: 'demo-admin', email: adminEmail, name: 'Murillo', profile: 'admin', ws: WS, status: 'approved' },
  { id: 'demo-carlos', email: 'carlos.mecanico@example.com', name: 'Carlos Andrade', profile: 'mecanico', ws: WS, status: 'approved' },
  { id: 'demo-joao', email: 'joao.freitas@example.com', name: 'João Freitas', profile: 'mecanico', ws: WS2, status: 'approved' },
  { id: 'demo-rafa', email: 'rafaela.estoque@example.com', name: 'Rafaela Lima', profile: 'estoquista', ws: WS, status: 'approved' },
  { id: 'demo-bia', email: 'beatriz.recepcao@example.com', name: 'Beatriz Souza', profile: 'recepcao', ws: WS, status: 'approved' },
  { id: 'demo-larissa', email: 'larissa.cs@example.com', name: 'Larissa Prado', profile: 'cs', ws: WS, status: 'approved' },
  { id: 'demo-paulo', email: 'paulo.gestor@example.com', name: 'Paulo Mendes', profile: 'gestor', ws: WS, status: 'approved' },
  { id: 'demo-novo', email: 'pedro.aprendiz@example.com', name: 'Pedro Henrique', profile: 'mecanico', ws: WS2, status: 'pending' },
];
const MECHANICS = TEAM.filter(u => u.profile === 'mecanico' && u.status === 'approved');

// ---------------------------------------------------------------- peças [nome, sku, preço, mínimo, fornecedor]
const PARTS: Record<string, [string, string, number, number, string][]> = {
  'Filtros e Lubrificantes': [
    ['Óleo 5W30 sintético (1 L)', 'LUB-5W30', 42.9, 30, 'Distribuidora Lubrimax'],
    ['Óleo 15W40 semissintético (1 L)', 'LUB-15W40', 31.5, 24, 'Distribuidora Lubrimax'],
    ['Óleo 4T 10W30 moto (1 L)', 'LUB-4T', 29.9, 20, 'Distribuidora Lubrimax'],
    ['Filtro de óleo (linha leve)', 'FIL-OLE', 28.0, 15, 'Auto Peças Central'],
    ['Filtro de ar do motor', 'FIL-AR', 46.0, 10, 'Auto Peças Central'],
    ['Filtro de combustível', 'FIL-COMB', 38.5, 8, 'Auto Peças Central'],
    ['Filtro de cabine (ar-condicionado)', 'FIL-CAB', 35.0, 8, 'Auto Peças Central'],
    ['Fluido de freio DOT 4 (500 ml)', 'FLU-DOT4', 27.9, 10, 'Distribuidora Lubrimax'],
    ['Aditivo de radiador (1 L)', 'FLU-RAD', 24.9, 10, 'Distribuidora Lubrimax'],
  ],
  'Freios': [
    ['Pastilha de freio dianteira', 'FRE-PAST-D', 129.0, 8, 'Freios Brasil'],
    ['Pastilha de freio traseira', 'FRE-PAST-T', 109.0, 6, 'Freios Brasil'],
    ['Disco de freio dianteiro (par)', 'FRE-DISCO', 389.0, 3, 'Freios Brasil'],
    ['Lona de freio traseira', 'FRE-LONA', 98.0, 4, 'Freios Brasil'],
    ['Cilindro de roda', 'FRE-CIL', 85.0, 3, 'Freios Brasil'],
    ['Pastilha de freio moto', 'FRE-PAST-M', 59.9, 6, 'Moto Parts SP'],
  ],
  'Suspensão e Direção': [
    ['Amortecedor dianteiro', 'SUS-AMO-D', 289.0, 4, 'Suspensul'],
    ['Amortecedor traseiro', 'SUS-AMO-T', 249.0, 4, 'Suspensul'],
    ['Bieleta', 'SUS-BIEL', 69.0, 6, 'Suspensul'],
    ['Pivô de suspensão', 'SUS-PIVO', 79.0, 6, 'Suspensul'],
    ['Terminal de direção', 'DIR-TERM', 72.0, 6, 'Suspensul'],
    ['Bucha da bandeja', 'SUS-BUCHA', 39.0, 8, 'Suspensul'],
    ['Coxim do amortecedor', 'SUS-COXIM', 89.0, 4, 'Suspensul'],
  ],
  'Motor': [
    ['Vela de ignição', 'MOT-VELA', 32.0, 16, 'Auto Peças Central'],
    ['Cabo de vela (jogo)', 'MOT-CABO', 149.0, 3, 'Auto Peças Central'],
    ['Bobina de ignição', 'MOT-BOB', 219.0, 3, 'Auto Peças Central'],
    ['Correia dentada', 'MOT-CORR', 159.0, 4, 'Correias & Cia'],
    ['Tensor da correia dentada', 'MOT-TENS', 189.0, 3, 'Correias & Cia'],
    ['Correia do alternador', 'MOT-ALT', 69.0, 5, 'Correias & Cia'],
    ['Bomba d’água', 'MOT-BAGUA', 239.0, 2, 'Auto Peças Central'],
    ['Junta da tampa de válvulas', 'MOT-JUNTA', 58.0, 4, 'Auto Peças Central'],
    ['Válvula termostática', 'MOT-TERMO', 99.0, 3, 'Auto Peças Central'],
  ],
  'Elétrica': [
    ['Bateria 60 Ah', 'ELE-BAT60', 549.0, 3, 'Baterias Volt'],
    ['Lâmpada H4', 'ELE-H4', 24.0, 12, 'Elétrica Luz'],
    ['Lâmpada de lanterna', 'ELE-LANT', 6.5, 20, 'Elétrica Luz'],
    ['Fusível (cartela)', 'ELE-FUS', 12.0, 10, 'Elétrica Luz'],
    ['Relé auxiliar', 'ELE-RELE', 29.0, 6, 'Elétrica Luz'],
    ['Palheta do limpador (par)', 'ELE-PALH', 59.0, 8, 'Elétrica Luz'],
  ],
  'Moto': [
    ['Kit relação (coroa, pinhão e corrente)', 'MOT-KITREL', 189.0, 4, 'Moto Parts SP'],
    ['Cabo de embreagem moto', 'MOT-CEMB', 32.0, 5, 'Moto Parts SP'],
    ['Pneu traseiro 100/80-18', 'MOT-PN-T', 239.0, 4, 'Pneus Rota'],
    ['Pneu dianteiro 80/100-18', 'MOT-PN-D', 199.0, 4, 'Pneus Rota'],
    ['Câmara de ar aro 18', 'MOT-CAM', 39.0, 6, 'Pneus Rota'],
  ],
  'Ar-condicionado': [
    ['Gás refrigerante R134a (carga)', 'AC-GAS', 180.0, 4, 'Clima Car'],
    ['Válvula de expansão', 'AC-VALV', 210.0, 2, 'Clima Car'],
  ],
};

// ---------------------------------------------------------------- serviços [nome, preço, tipo repasse, valor]
const SERVICES: [string, number, 'fixed' | 'percent', number][] = [
  ['Troca de óleo e filtro', 80, 'fixed', 10],
  ['Revisão preventiva completa', 350, 'percent', 12],
  ['Alinhamento e balanceamento', 120, 'fixed', 15],
  ['Troca de pastilhas de freio', 120, 'fixed', 15],
  ['Revisão do sistema de freios', 180, 'percent', 10],
  ['Troca de amortecedores (par)', 260, 'percent', 10],
  ['Troca de correia dentada', 380, 'percent', 12],
  ['Diagnóstico eletrônico (scanner)', 150, 'fixed', 20],
  ['Higienização e carga do ar-condicionado', 220, 'percent', 10],
  ['Troca de bateria', 50, 'fixed', 5],
  ['Revisão de moto', 160, 'percent', 10],
  ['Troca de kit relação (moto)', 90, 'fixed', 10],
];
// Peças que cada serviço costuma levar: [sku, qtd mín, qtd máx]
const SERVICE_PARTS: Record<string, [string, number, number][]> = {
  'Troca de óleo e filtro': [['LUB-5W30', 3, 5], ['FIL-OLE', 1, 1]],
  'Revisão preventiva completa': [['LUB-5W30', 4, 5], ['FIL-OLE', 1, 1], ['FIL-AR', 1, 1], ['FIL-COMB', 1, 1], ['FIL-CAB', 1, 1], ['MOT-VELA', 4, 4]],
  'Alinhamento e balanceamento': [],
  'Troca de pastilhas de freio': [['FRE-PAST-D', 1, 1], ['FLU-DOT4', 0, 1]],
  'Revisão do sistema de freios': [['FLU-DOT4', 1, 2], ['FRE-LONA', 0, 1], ['FRE-CIL', 0, 1]],
  'Troca de amortecedores (par)': [['SUS-AMO-D', 2, 2], ['SUS-COXIM', 0, 2], ['SUS-BIEL', 0, 2]],
  'Troca de correia dentada': [['MOT-CORR', 1, 1], ['MOT-TENS', 1, 1], ['MOT-BAGUA', 0, 1]],
  'Diagnóstico eletrônico (scanner)': [['MOT-BOB', 0, 1], ['MOT-VELA', 0, 4]],
  'Higienização e carga do ar-condicionado': [['AC-GAS', 1, 1], ['FIL-CAB', 1, 1]],
  'Troca de bateria': [['ELE-BAT60', 1, 1]],
  'Revisão de moto': [['LUB-4T', 1, 1], ['FRE-PAST-M', 0, 1], ['MOT-CEMB', 0, 1]],
  'Troca de kit relação (moto)': [['MOT-KITREL', 1, 1]],
};

const FIRST = ['Ana', 'Bruno', 'Camila', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'Jorge', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Ricardo', 'Sabrina', 'Thiago', 'Vanessa', 'Wesley', 'Juliana', 'Rodrigo', 'Fernanda', 'Lucas', 'Patrícia', 'André', 'Cláudia', 'Mateus', 'Renata', 'Sérgio'];
const LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Ferreira', 'Carvalho', 'Gomes', 'Martins', 'Rocha'];
const CARS = ['HB20', 'Onix', 'Gol', 'Corolla', 'Civic', 'Strada', 'Saveiro', 'Fiesta', 'Ka', 'Sandero', 'Kwid', 'Polo', 'T-Cross', 'Compass', 'HR-V', 'Hilux', 'S10', 'Uno', 'Palio', 'Argo'];
const MOTOS = ['Haojue DK 160', 'Honda CG 160', 'Yamaha Factor 150', 'Honda Biz 125', 'Yamaha Fazer 250'];
const plate = () => `${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${int(0, 9)}${String.fromCharCode(65 + int(0, 9))}${int(10, 99)}`;
const CUSTOMERS = Array.from({ length: 140 }, () => {
  const moto = rnd() < 0.22;
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    phone: `(11) 9${int(6000, 9999)}-${int(1000, 9999)}`,
    vehicle: moto ? pick(MOTOS) : pick(CARS),
    plate: plate(),
    moto,
  };
});

async function main() {
  const db = createDb();
  const t0 = Date.now();

  // Recomeça do zero: apagar a oficina leva junto (cascade) tudo que é dela.
  await db.delete(users).where(eq(sql`lower(${users.email})`, adminEmail));
  for (const old of [WS, WS2, 'demo-munago']) {
    await db.delete(workspaces).where(eq(workspaces.id, old));
    await db.delete(settings).where(eq(settings.id, old));
  }
  await db.insert(workspaces).values([
    { id: WS, name: 'Base Centro', createdAt: START },
    { id: WS2, name: 'Base Canindé', createdAt: START },
  ]);
  await db.insert(settings).values([
    { id: WS, data: {
      ...DEFAULT_SETTINGS, storeName: 'Base Centro', contactPhone: '(11) 3456-7890',
      contactEmail: 'centro@munago.example.com', address: 'Av. das Oficinas, 1200 - Vila Industrial, São Paulo/SP',
      repasseMinPercent: MIN_PERCENT,
      franchiseeName: 'Ricardo Alves', franchiseeEmail: 'ricardo.franqueado@example.com', franchiseePhone: '(11) 90000-0001',
    } },
    { id: WS2, data: {
      ...DEFAULT_SETTINGS, storeName: 'Base Canindé', repasseMinPercent: MIN_PERCENT,
      franchiseeName: 'Sandra Moreira', franchiseeEmail: 'sandra.franqueada@example.com', franchiseePhone: '(11) 90000-0002',
    } },
  ]);
  await db.insert(users).values(TEAM.map(({ ws, ...u }, i) => ({
    ...u, workspaceId: ws, role: PROFILES[u.profile].role, permissions: null, createdAt: new Date(START.getTime() + i * 3 * 86_400_000),
  })));

  // Categorias e peças
  const prodBySku = new Map<string, { id: string; name: string; price: number; min: number; stock: number }>();
  const prodRows: (typeof products.$inferInsert)[] = [];
  const catRows: (typeof categories.$inferInsert)[] = [];
  for (const [cat, parts] of Object.entries(PARTS)) {
    catRows.push({ id: id('cat'), workspaceId: WS, name: cat, createdAt: START });
    for (const [name, sku, price, min, supplier] of parts) {
      const p = { id: id('prd'), name, price, min, stock: min * 3 };
      prodBySku.set(sku, p);
      prodRows.push({ id: p.id, workspaceId: WS, sku, name, category: cat, price, laborCost: 0, quantity: 0, minQuantity: min, supplier, createdAt: START, updatedAt: START });
    }
  }
  await db.insert(categories).values(catRows);

  const svcRows = SERVICES.map(([name, price, repasseType, repasseValue]) => ({
    id: id('svc'), workspaceId: WS, name, price, repasseType, repasseValue, createdAt: START, updatedAt: START,
  }));
  await db.insert(services).values(svcRows);

  // Estoque inicial (compra de abertura)
  const txRows: (typeof transactions.$inferInsert)[] = [];
  for (const p of prodBySku.values()) {
    txRows.push({ id: id('tx'), workspaceId: WS, productId: p.id, productName: p.name, type: 'in', quantity: p.stock, reason: 'Estoque inicial', userId: 'demo-rafa', userName: 'Rafaela Lima', timestamp: START });
  }

  // Um ano de OS, dia a dia
  const osRows: (typeof serviceOrders.$inferInsert)[] = [];
  const pendingRestock = new Map<string, number>(); // sku -> dia (ms) em que a compra chega
  for (let t = START.getTime() + 86_400_000; t <= NOW.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getDay();
    const daysAgo = Math.floor((NOW.getTime() - t) / 86_400_000);

    // Compras que chegaram hoje (as das últimas 3 semanas "atrasam" para sobrar alerta de estoque baixo)
    for (const [sku, arrive] of pendingRestock) {
      if (arrive > t || daysAgo < 20) continue;
      const p = prodBySku.get(sku)!;
      const qty = p.min * int(3, 4) - Math.max(p.stock, 0);
      if (qty > 0) {
        p.stock += qty;
        txRows.push({ id: id('tx'), workspaceId: WS, productId: p.id, productName: p.name, type: 'in', quantity: qty, reason: `Compra - NF ${int(10000, 99999)}`, userId: 'demo-rafa', userName: 'Rafaela Lima', timestamp: new Date(t + 9 * 3_600_000) });
      }
      pendingRestock.delete(sku);
    }

    if (dow === 0) continue; // domingo fechado
    // Movimento cresce ao longo do ano e é maior em dezembro/janeiro (férias) e no começo da semana
    const growth = 1 + (365 - daysAgo) / 365 * 0.6;
    const season = [1.3, 1.1, 1, 0.95, 0.9, 0.95, 1.15, 1, 0.95, 1, 1.05, 1.35][d.getMonth()];
    const base = dow === 6 ? 1.5 : dow === 1 ? 3.2 : 2.5;
    const count = Math.max(0, Math.round(base * growth * season + (rnd() - 0.5) * 2));

    for (let k = 0; k < count; k++) {
      const c = pick(CUSTOMERS);
      const pool = c.moto ? SERVICES.filter(s => ['Revisão de moto', 'Troca de kit relação (moto)', 'Troca de óleo e filtro'].includes(s[0])) : SERVICES.filter(s => !s[0].includes('moto'));
      const chosen = new Set([pick(pool)]);
      if (rnd() < 0.35) chosen.add(pick(pool));

      const serviceItems: ServiceOrderService[] = [];
      const items: ServiceOrderItem[] = [];
      for (const [name, price, repasseType, repasseValue] of chosen) {
        const svc = svcRows.find(s => s.name === name)!;
        serviceItems.push({ serviceId: svc.id, name, price, quantity: 1, repasseType, repasseValue, repasseAmount: serviceRepasse(price, 1, repasseType, repasseValue) });
        for (const [sku, a, b] of SERVICE_PARTS[name]) {
          const qty = c.moto && sku === 'LUB-5W30' ? 0 : int(a, b);
          const p = prodBySku.get(c.moto && sku === 'LUB-5W30' ? 'LUB-4T' : sku)!;
          if (qty <= 0 || p.stock < qty) continue; // sem peça no estoque: segue sem ela
          const prev = items.find(i => i.productId === p.id);
          if (prev) { prev.quantity += qty; prev.total = r2(prev.quantity * prev.price); }
          else items.push({ productId: p.id, name: p.name, quantity: qty, price: p.price, laborCost: 0, total: r2(qty * p.price) });
        }
      }

      const totalPartsCost = r2(items.reduce((a, i) => a + i.total, 0));
      const totalLaborCost = r2(serviceItems.reduce((a, s) => a + s.price, 0));
      const totalAmount = r2(totalPartsCost + totalLaborCost);
      const repasseAmount = Math.max(r2(serviceItems.reduce((a, s) => a + s.repasseAmount, 0)), Math.round(totalAmount * MIN_PERCENT) / 100);
      const osId = id('os');
      const mech = pick(MECHANICS);
      const created = new Date(t + int(8, 16) * 3_600_000 + int(0, 59) * 60_000);
      if (created > NOW) continue; // hoje: só o que já aconteceu
      const doneAt = new Date(Math.min(created.getTime() + int(2, 30) * 3_600_000, NOW.getTime()));

      // OS recentes ainda estão abertas; as antigas foram concluídas e quase todas pagas
      let status: 'draft' | 'in_progress' | 'completed' | 'paid' = 'paid';
      if (daysAgo <= 2) status = pick(['draft', 'in_progress', 'in_progress'] as const);
      else if (daysAgo <= 6) status = pick(['in_progress', 'completed', 'paid', 'paid'] as const);
      else if (rnd() < 0.06) status = 'completed';
      const finished = status === 'completed' || status === 'paid';

      // Peças saem do estoque quando a OS entra em serviço
      if (status !== 'draft') {
        for (const i of items) {
          const p = prodBySku.get([...prodBySku.entries()].find(([, v]) => v.id === i.productId)![0])!;
          p.stock -= i.quantity;
          txRows.push({ id: id('tx'), workspaceId: WS, productId: p.id, productName: p.name, type: 'out', quantity: i.quantity, reason: `Ordem de Serviço #${osId.slice(-6).toUpperCase()}`, userId: mech.id, userName: mech.name, timestamp: created });
          const sku = [...prodBySku.entries()].find(([, v]) => v === p)![0];
          if (p.stock <= p.min && !pendingRestock.has(sku)) pendingRestock.set(sku, t + int(2, 5) * 86_400_000);
        }
      }

      osRows.push({
        id: osId, workspaceId: WS, customerName: c.name, customerPhone: c.phone, vehicleModel: c.vehicle, vehiclePlate: c.plate,
        items, serviceItems, repasseAmount, generalLaborCost: 0, totalLaborCost, totalPartsCost, totalAmount,
        status, maintenanceType: [...chosen].some(s => s[0].startsWith('Revisão') || s[0].startsWith('Troca de óleo')) ? 'preventiva' : 'corretiva',
        scheduledDate: day(created), completionDate: finished ? day(doneAt) : null,
        observations: rnd() < 0.15 ? pick(['Cliente pediu orçamento por WhatsApp.', 'Barulho na suspensão ao passar em lombada.', 'Retorno de garantia.', 'Cliente vai buscar no fim da tarde.']) : null,
        ...(status === 'paid' ? { ...freezeSplit(totalAmount, repasseAmount), paidAt: doneAt, asaasPaymentId: `pay_demo_${osId}` } : {}),
        createdBy: mech.id, createdAt: created, updatedAt: finished ? doneAt : created,
      });
    }

    // Ajustes e devoluções esporádicos
    if (rnd() < 0.05 && t + 17 * 3_600_000 < NOW.getTime()) {
      const p = pick([...prodBySku.values()]);
      if (p.stock > 1) {
        p.stock -= 1;
        txRows.push({ id: id('tx'), workspaceId: WS, productId: p.id, productName: p.name, type: 'out', quantity: 1, reason: pick(['Peça com defeito - devolvida ao fornecedor', 'Ajuste de inventário']), userId: 'demo-rafa', userName: 'Rafaela Lima', timestamp: new Date(t + 17 * 3_600_000) });
      }
    }
  }

  // Quantidade final = resultado da simulação
  for (const row of prodRows) {
    const p = prodBySku.get(row.sku!)!;
    row.quantity = Math.max(0, p.stock);
    row.updatedAt = NOW;
  }
  await db.insert(products).values(prodRows);

  const chunk = async <T,>(rows: T[], insert: (part: T[]) => Promise<unknown>) => { for (let i = 0; i < rows.length; i += 400) await insert(rows.slice(i, i + 400)); };
  await chunk(osRows, part => db.insert(serviceOrders).values(part));
  await chunk(txRows, part => db.insert(transactions).values(part));

  // Alertas: estoque baixo atual (não lidos) + histórico já lido
  const low = prodRows.filter(p => p.quantity! <= p.minQuantity!);
  const notifRows: (typeof notifications.$inferInsert)[] = low.map(p => ({
    id: id('ntf'), workspaceId: WS, title: 'Estoque baixo', message: `${p.name} está com ${p.quantity} un (mínimo ${p.minQuantity}).`,
    productId: p.id, type: 'low_stock', read: false, timestamp: new Date(NOW.getTime() - int(1, 72) * 3_600_000),
  }));
  for (let i = 0; i < 40; i++) {
    const p = pick(prodRows);
    notifRows.push({ id: id('ntf'), workspaceId: WS, title: 'Estoque baixo', message: `${p.name} chegou no mínimo (${p.minQuantity} un).`, productId: p.id, type: 'low_stock', read: true, timestamp: new Date(START.getTime() + rnd() * (NOW.getTime() - START.getTime() - 30 * 86_400_000)) });
  }
  await db.insert(notifications).values(notifRows);

  // OS de motos: uma em cada etapa do fluxo, com a linha do tempo de quem fez o quê
  // Fotos de exemplo (cinza = chegada, verde = moto pronta): no sistema de verdade são as fotos tiradas na chegada.
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGOwt3eDIwacHACy+wkxyz8v7QAAAABJRU5ErkJggg==';
  const PX_DONE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGMQSzWBIwacHACetQg1nevXnQAAAABJRU5ErkJggg==';
  const photos = { front: PX, back: PX, left: PX, right: PX, odometer: PX };
  const person = (id: string) => TEAM.find(u => u.id === id)!;
  const ev = (type: MotoEvent['type'], who: string, minutesAgo: number, note?: string): MotoEvent =>
    ({ type, at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(), by: who, byName: person(who).name, note });
  const ITEMS: MotoItem[] = [
    { code: 'FRE-PAST-M', description: 'Pastilha de freio moto', quantity: 1, purpose: 'Freio dianteiro gasto' },
    { code: 'LUB-4T', description: 'Óleo 4T 10W30 moto (1 L)', quantity: 1, purpose: 'Troca de óleo vencida' },
    { code: 'MOT-KITREL', description: 'Kit relação (coroa, pinhão e corrente)', quantity: 1, purpose: 'Corrente esticada, barulho' },
  ];
  const motoRows: (typeof motoCheckins.$inferInsert)[] = [];
  const flow: [MotoStatus, number][] = [
    ['recebida', 25], ['recebida', 70], ['aguardando_estoque', 140], ['aguardando_peca', 300], ['aguardando_autorizacao', 200],
    ['autorizada', 260], ['em_manutencao', 380], ['em_manutencao', 140], ['finalizada', 1500], ['finalizada', 3000], ['entregue', 4300], ['recusada', 2000],
  ];
  const MOTO_MODELS = ['Haojue DK 160', 'Haojue DK 150', 'Yamaha Factor 150', 'Avelloz', 'Shineray SHI 175', 'Shineray SHI 250'];
  flow.forEach(([status, age], i) => {
    const mech = 'demo-carlos';
    const notes = pick(['Risco no tanque lado esquerdo.', 'Retrovisor direito quebrado.', 'Cliente relata barulho na corrente.', 'Pneu traseiro careca.', null]);
    const events: MotoEvent[] = [ev('recebida', 'demo-bia', age, notes ?? undefined)];
    const order: MotoStatus[] = ['recebida', 'aguardando_estoque', 'aguardando_autorizacao', 'autorizada', 'em_manutencao', 'finalizada', 'entregue'];
    const reach = (st: MotoStatus) => order.indexOf(st) <= order.indexOf(status === 'aguardando_peca' ? 'aguardando_estoque' : status === 'recusada' ? 'aguardando_autorizacao' : status);
    const items = reach('aguardando_estoque') ? ITEMS.slice(0, 1 + (i % 3)) : [];
    if (reach('aguardando_estoque')) events.push(ev('diagnose', mech, age - 20));
    if (status === 'aguardando_peca') events.push(ev('stock_missing', 'demo-rafa', age - 40, 'Kit relação em falta, pedido ao fornecedor.'));
    if (reach('aguardando_autorizacao')) events.push(ev('stock_ok', 'demo-rafa', age - 45));
    if (status === 'aguardando_autorizacao' || status === 'recusada' || reach('autorizada')) events.push(ev('request_auth', 'demo-larissa', age - 60, 'Por WhatsApp para (11) 90000-0001'));
    if (status === 'recusada') events.push(ev('reject', 'demo-larissa', age - 90, 'Cliente não aprovou o orçamento.'));
    if (reach('autorizada')) events.push(ev('authorize', 'demo-larissa', age - 90));
    const startMin = age - 110;
    if (reach('em_manutencao')) events.push(ev('start', mech, startMin));
    const finishMin = startMin - 35 - (i * 7) % 60;
    if (reach('finalizada')) events.push(ev('finish', mech, finishMin, 'Serviço concluído e testado.'));
    if (status === 'entregue') events.push(ev('deliver', 'demo-bia', finishMin - 40, 'Retirada pelo locatário.'));
    motoRows.push({
      id: id('moto'), workspaceId: WS, plate: plate(), model: MOTO_MODELS[i % MOTO_MODELS.length], km: int(3000, 42000),
      franchiseName: pick(['Locadora Moto Rápida', 'Entregas Express', 'Rota Motos', 'Frota Já']), customerName: `${pick(FIRST)} ${pick(LAST)}`, customerPhone: `(11) 9${int(6000, 9999)}-${int(1000, 9999)}`, photos: { ...photos, ...(reach('autorizada') ? { authProof: { name: 'autorizacao-franqueado.png', url: PX } } : {}), ...(reach('finalizada') ? { final: [PX_DONE, PX_DONE] } : {}) }, notes, status,
      items: items.map(it => ({ ...it, ...(reach('aguardando_autorizacao') || status === 'aguardando_peca' ? { available: !(status === 'aguardando_peca' && it.code === 'MOT-KITREL') } : {}) })),
      events,
      estimatedMinutes: reach('aguardando_estoque') ? ({ 6: 90, 7: 90, 10: 30 } as Record<number, number>)[i] ?? [45, 60, 90][i % 3] : null, // 6: atrasada, 7: no prazo, 10: terminou atrasada
      startedAt: reach('em_manutencao') ? new Date(NOW.getTime() - startMin * 60_000) : null,
      finishedAt: reach('finalizada') ? new Date(NOW.getTime() - finishMin * 60_000) : null,
      createdBy: 'demo-bia', createdByName: person('demo-bia').name, createdAt: new Date(NOW.getTime() - age * 60_000),
    });
  });
  await db.insert(motoCheckins).values(motoRows);
  // Aviso de cada OS para o setor que precisa agir agora
  await db.insert(notifications).values(motoRows.flatMap(m => {
    const n = MOTO_NOTIFY[m.status as MotoStatus];
    return n ? [{ id: id('ntf'), workspaceId: WS, type: 'moto_os', target: n.target, refId: m.id, title: `${m.model} · ${m.plate}`, message: `A moto ${n.text}.`, timestamp: (m.events as MotoEvent[]).at(-1) ? new Date((m.events as MotoEvent[]).at(-1)!.at) : NOW }] : [];
  }));

  // Pedidos de acesso (tela de cadastros)
  await db.delete(accessRequests).where(sql`${accessRequests.email} like '%@example.com'`);
  await db.insert(accessRequests).values([
    { id: id('acc'), name: 'Roberto Dias', email: 'roberto.autocenter@example.com', workshopName: 'Auto Center Dias', phone: '(11) 97777-1234', message: 'Tenho uma oficina com 4 elevadores.', status: 'pending', timestamp: new Date(NOW.getTime() - 2 * 86_400_000) },
    { id: id('acc'), name: 'Simone Prado', email: 'simone.motos@example.com', workshopName: 'Prado Motos', phone: '(11) 96666-4321', message: null, status: 'pending', timestamp: new Date(NOW.getTime() - 5 * 86_400_000) },
    { id: id('acc'), name: 'Fábio Nunes', email: 'fabio.nunes@example.com', workshopName: 'Nunes Mecânica', phone: null, message: 'Indicação do Carlos.', status: 'approved', timestamp: new Date(NOW.getTime() - 120 * 86_400_000) },
  ]);

  const paid = osRows.filter(o => o.status === 'paid');
  const revenue = paid.reduce((a, o) => a + (o.totalAmount ?? 0), 0);
  console.log(`Oficina demo criada em ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
  console.log(`  2 Bases isoladas (Base Centro com todos os dados, Base Canindé vazia); ${TEAM.length} pessoas, ${prodRows.length} peças, ${svcRows.length} serviços`);
  console.log(`  ${osRows.length} OS (${paid.length} pagas, faturamento R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
  console.log(`  ${motoRows.length} OS de motos em todas as etapas do fluxo`);
  console.log(`  ${txRows.length} movimentações, ${low.length} peças abaixo do mínimo, ${notifRows.length} alertas`);
  await db.$client.end();
}

main().catch((e) => {
  console.error('Falhou:', e instanceof Error ? e.message : e);
  if (e instanceof Error && e.cause) console.error('Causa:', e.cause instanceof Error ? e.cause.message : e.cause);
  process.exit(1);
});
