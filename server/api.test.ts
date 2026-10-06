import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createHarness } from './test/apiHarness';
import { notifications, products, serviceOrders, transactions, users } from './db/schema';

type H = Awaited<ReturnType<typeof createHarness>>;

const product = (over: object = {}) => ({ name: 'Filtro de óleo', quantity: 5, minQuantity: 2, price: 39.9, ...over });

describe('API v1', () => {
  let h: H;
  beforeEach(async () => { h = await createHarness(); });

  describe('auth', () => {
    it('401 sem token', async () => {
      await request(h.app).get('/api/v1/products').expect(401);
    });
    it('pendente não lê produtos', async () => {
      await h.as('pending').get('/products').expect(403);
    });
    it('/me funciona para pendente e traz permissões efetivas', async () => {
      const res = await h.as('pending').get('/me').expect(200);
      expect(res.body).toMatchObject({ id: 'pending', status: 'pending', permissions: { canManageInventory: true } });
    });
  });

  describe('products', () => {
    it('editor cria, lista, edita e exclui', async () => {
      const created = await h.as('editor').post('/products', product()).expect(201);
      expect(created.body).toMatchObject({ name: 'Filtro de óleo', quantity: 5, price: 39.9, status: 'ativo' });
      expect(h.changes).toContain('products');

      const list = await h.as('viewer').get('/products').expect(200);
      expect(list.body).toHaveLength(1);

      const upd = await h.as('editor').patch(`/products/${created.body.id}`, { name: 'Filtro X' }).expect(200);
      expect(upd.body.name).toBe('Filtro X');

      await h.as('editor').del(`/products/${created.body.id}`).expect(204);
      expect((await h.as('viewer').get('/products')).body).toHaveLength(0);
    });

    it('PATCH parcial não reseta campos com default (status)', async () => {
      const { id } = (await h.as('editor').post('/products', product({ status: 'inativo' }))).body;
      const res = await h.as('editor').patch(`/products/${id}`, { name: 'Outro' }).expect(200);
      expect(res.body.status).toBe('inativo');
    });

    it('viewer não cria', async () => {
      await h.as('viewer').post('/products', product()).expect(403);
    });

    it('valida payload', async () => {
      const res = await h.as('editor').post('/products', { name: '', quantity: 'x' }).expect(400);
      expect(res.body.code).toBe('VALIDATION');
    });

    it('bloqueia quantidade negativa quando configurado', async () => {
      await h.as('editor').post('/products', product({ quantity: -1 })).expect(400);
      await h.as('admin').patch('/settings', { allowNegativeStock: true }).expect(200);
      await h.as('editor').post('/products', product({ quantity: -1 })).expect(201);
    });

    it('bulk insert e bulk update', async () => {
      const res = await h.as('editor').post('/products/bulk', [product({ name: 'A' }), product({ name: 'B' })]).expect(201);
      const ids = res.body.map((p: { id: string }) => p.id);
      await h.as('editor').patch('/products/bulk', { ids, updates: { status: 'inativo' } }).expect(204);
      const all = (await h.as('viewer').get('/products')).body;
      expect(all.map((p: { status: string }) => p.status)).toEqual(['inativo', 'inativo']);
    });
  });

  describe('transactions (estoque)', () => {
    let productId: string;
    beforeEach(async () => {
      productId = (await h.as('editor').post('/products', product({ quantity: 5, minQuantity: 2 }))).body.id;
      h.changes.length = 0;
    });

    it('entrada soma e saída subtrai, usando usuário autenticado', async () => {
      await h.as('editor').post('/transactions', { productId, type: 'in', quantity: 3, reason: 'Compra', userId: 'forjado' }).expect(201);
      const out = await h.as('editor').post('/transactions', { productId, type: 'out', quantity: 4 }).expect(201);
      expect(out.body).toMatchObject({ newQty: 4, lowStock: false });

      const txs = await h.db.select().from(transactions);
      expect(txs).toHaveLength(2);
      expect(txs.every((t) => t.userId === 'editor' && t.userName === 'Editor')).toBe(true);
      expect(h.changes).toEqual(expect.arrayContaining(['transactions', 'products']));
    });

    it('saída maior que estoque falha sem gravar nada', async () => {
      const res = await h.as('editor').post('/transactions', { productId, type: 'out', quantity: 6 }).expect(400);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
      expect(await h.db.select().from(transactions)).toHaveLength(0);
      const [p] = await h.db.select().from(products).where(eq(products.id, productId));
      expect(p.quantity).toBe(5);
    });

    it('cruzar o mínimo cria uma notificação, sem duplicar enquanto não lida', async () => {
      const r1 = await h.as('editor').post('/transactions', { productId, type: 'out', quantity: 3 }).expect(201);
      expect(r1.body).toMatchObject({ newQty: 2, lowStock: true });
      await h.as('editor').post('/transactions', { productId, type: 'out', quantity: 1 }).expect(201);
      const notes = await h.db.select().from(notifications);
      expect(notes).toHaveLength(1);
      expect(notes[0].message).toContain('Filtro de óleo');
      expect(h.changes).toContain('notifications');
    });

    it('viewer não movimenta', async () => {
      await h.as('viewer').post('/transactions', { productId, type: 'in', quantity: 1 }).expect(403);
    });

    it('quantidade precisa ser inteiro positivo', async () => {
      await h.as('editor').post('/transactions', { productId, type: 'in', quantity: 0 }).expect(400);
    });

    it('lista em ordem decrescente', async () => {
      await h.as('editor').post('/transactions', { productId, type: 'in', quantity: 1, reason: 'primeira' });
      await h.as('editor').post('/transactions', { productId, type: 'in', quantity: 1, reason: 'segunda' });
      const list = (await h.as('viewer').get('/transactions')).body;
      expect(list.map((t: { reason: string }) => t.reason)).toEqual(['segunda', 'primeira']);
    });
  });

  describe('service orders', () => {
    let a: string;
    let b: string;
    beforeEach(async () => {
      a = (await h.as('editor').post('/products', product({ name: 'A', quantity: 10 }))).body.id;
      b = (await h.as('editor').post('/products', product({ name: 'B', quantity: 1 }))).body.id;
    });

    const os = (items: object[]) => ({
      customerName: 'João', vehiclePlate: 'ABC1D23', scheduledDate: '2026-10-06T10:00',
      items, generalLaborCost: 50, totalLaborCost: 50, totalPartsCost: 100, totalAmount: 150,
    });
    const item = (productId: string, quantity: number) =>
      ({ productId, name: 'Peça', quantity, price: 10, laborCost: 0, total: 10 * quantity });

    it('cria OS, baixa estoque e registra movimentações', async () => {
      const res = await h.as('editor').post('/service-orders', os([item(a, 2), item(b, 1)])).expect(201);
      expect(res.body).toMatchObject({ customerName: 'João', createdBy: 'editor', status: 'draft' });

      const qty = Object.fromEntries((await h.db.select().from(products)).map((p) => [p.id, p.quantity]));
      expect(qty).toEqual({ [a]: 8, [b]: 0 });
      const txs = await h.db.select().from(transactions);
      expect(txs).toHaveLength(2);
      expect(txs[0].reason).toBe(`Ordem de Serviço #${res.body.id.slice(-6).toUpperCase()}`);
    });

    it('um item sem estoque desfaz a OS inteira', async () => {
      await h.as('editor').post('/service-orders', os([item(a, 2), item(b, 5)])).expect(400);
      expect(await h.db.select().from(serviceOrders)).toHaveLength(0);
      expect(await h.db.select().from(transactions)).toHaveLength(0);
      const [pa] = await h.db.select().from(products).where(eq(products.id, a));
      expect(pa.quantity).toBe(10);
    });

    it('edita status mas não itens; exclui', async () => {
      const id = (await h.as('editor').post('/service-orders', os([item(a, 1)]))).body.id;
      const upd = await h.as('editor').patch(`/service-orders/${id}`, { status: 'completed', completionDate: '2026-10-07' }).expect(200);
      expect(upd.body).toMatchObject({ status: 'completed', totalAmount: 150, generalLaborCost: 50 });
      await h.as('editor').patch(`/service-orders/${id}`, { items: [] }).expect(400);
      await h.as('viewer').del(`/service-orders/${id}`).expect(403);
      await h.as('editor').del(`/service-orders/${id}`).expect(204);
    });

    describe('repasse no pagamento', () => {
      it('ao pagar usa o % padrão; OS não paga não tem repasse', async () => {
        await h.as('admin').patch('/settings', { companySharePercent: 30 }).expect(200);
        const id = (await h.as('editor').post('/service-orders', os([item(a, 1)]))).body.id;
        const open = await h.as('editor').patch(`/service-orders/${id}`, { status: 'completed' }).expect(200);
        expect(open.body).toMatchObject({ companySharePercent: null, companyAmount: null, workshopAmount: null, paidAt: null });

        const paid = await h.as('editor').patch(`/service-orders/${id}`, { status: 'paid' }).expect(200);
        expect(paid.body).toMatchObject({ companySharePercent: 30, companyAmount: 45, workshopAmount: 105 });
        expect(paid.body.paidAt).toBeTruthy();
      });

      it('% ajustado na OS fica congelado mesmo se o padrão mudar', async () => {
        await h.as('admin').patch('/settings', { companySharePercent: 30 }).expect(200);
        const id = (await h.as('editor').post('/service-orders', { ...os([item(a, 1)]), status: 'paid', companySharePercent: 40 }).expect(201)).body.id;
        await h.as('admin').patch('/settings', { companySharePercent: 10 }).expect(200);

        const upd = await h.as('editor').patch(`/service-orders/${id}`, { observations: 'cliente pagou no pix' }).expect(200);
        expect(upd.body).toMatchObject({ companySharePercent: 40, companyAmount: 60, workshopAmount: 90 });
      });

      it('centavos: empresa + oficina sempre fecham o total', async () => {
        const body = { ...os([item(a, 1)]), totalAmount: 100.01, status: 'paid', companySharePercent: 33.33 };
        const res = await h.as('editor').post('/service-orders', body).expect(201);
        expect(res.body.companyAmount + res.body.workshopAmount).toBeCloseTo(100.01, 2);
        expect(res.body.companyAmount).toBe(33.33);
      });

      it('sair de pago limpa o repasse; % fora de 0–100 → 400', async () => {
        const id = (await h.as('editor').post('/service-orders', { ...os([item(a, 1)]), status: 'paid', companySharePercent: 50 })).body.id;
        const back = await h.as('editor').patch(`/service-orders/${id}`, { status: 'completed' }).expect(200);
        expect(back.body).toMatchObject({ companySharePercent: null, companyAmount: null, paidAt: null });
        await h.as('editor').patch(`/service-orders/${id}`, { status: 'paid', companySharePercent: 120 }).expect(400);
      });
    });
  });

  describe('categories', () => {
    it('renomear propaga para produtos; excluir com produto vinculado falha', async () => {
      const cat = (await h.as('editor').post('/categories', { name: 'Filtros' }).expect(201)).body;
      await h.as('editor').post('/products', product({ category: 'Filtros' }));
      await h.as('editor').patch(`/categories/${cat.id}`, { name: 'Filtros e Óleos' }).expect(200);
      const [p] = await h.db.select().from(products);
      expect(p.category).toBe('Filtros e Óleos');
      const res = await h.as('editor').del(`/categories/${cat.id}`).expect(409);
      expect(res.body.code).toBe('CATEGORY_IN_USE');
    });

    it('nome duplicado → 409', async () => {
      await h.as('editor').post('/categories', { name: 'Filtros' }).expect(201);
      await h.as('editor').post('/categories', { name: 'Filtros' }).expect(409);
    });
  });

  describe('settings', () => {
    it('defaults, merge e só admin altera', async () => {
      const def = await h.as('viewer').get('/settings').expect(200);
      expect(def.body).toMatchObject({ storeName: 'Munago Estoque', allowNegativeStock: false });
      await h.as('editor').patch('/settings', { storeName: 'X' }).expect(403);
      await h.as('admin').patch('/settings', { storeName: 'Oficina' }).expect(200);
      await h.as('admin').patch('/settings', { accentColor: '#ff0000' }).expect(200);
      const s = (await h.as('viewer').get('/settings')).body;
      expect(s).toMatchObject({ storeName: 'Oficina', accentColor: '#ff0000' });
    });
  });

  describe('notifications', () => {
    it('editor lê e marca como lida; viewer não lê', async () => {
      const pid = (await h.as('editor').post('/products', product({ quantity: 3, minQuantity: 2 }))).body.id;
      await h.as('editor').post('/transactions', { productId: pid, type: 'out', quantity: 1 });
      const [n] = (await h.as('editor').get('/notifications').expect(200)).body;
      await h.as('editor').patch(`/notifications/${n.id}/read`, {}).expect(204);
      const [after] = await h.db.select().from(notifications);
      expect(after.read).toBe(true);
      await h.as('viewer').get('/notifications').expect(403);
    });
  });

  describe('users', () => {
    it('admin cria usuário via Cognito', async () => {
      const res = await h.as('admin').post('/users', { email: 'Novo@X.com', name: 'Novo', role: 'editor' }).expect(201);
      expect(h.cognito.createUser).toHaveBeenCalledWith('novo@x.com', 'Novo');
      expect(res.body).toMatchObject({ id: 'cognito-sub-1', email: 'novo@x.com', role: 'editor', status: 'approved' });
    });

    it('e-mail já cadastrado → 409', async () => {
      await h.as('admin').post('/users', { email: 'editor@x.com', name: 'E', role: 'editor' }).expect(409);
      expect(h.cognito.createUser).not.toHaveBeenCalled();
    });

    it('não-admin não lista nem cria', async () => {
      await h.as('editor').get('/users').expect(403);
      await h.as('editor').post('/users', { email: 'a@b.com', name: 'A', role: 'viewer' }).expect(403);
    });

    it('gerente de usuários não-admin não pode promover a admin', async () => {
      await h.db.update(users).set({ permissions: {
        canManageInventory: true, canManageOS: true, canManageUsers: true, canViewReports: true, canPerformTransactions: true,
      } }).where(eq(users.id, 'editor'));
      await h.as('editor').patch('/users/viewer', { role: 'admin' }).expect(403);
      await h.as('editor').patch('/users/admin', { status: 'denied' }).expect(403);
      await h.as('editor').patch('/users/viewer', { role: 'editor' }).expect(200);
    });

    it('mudar cargo aplica permissões padrão; aprovar/negar', async () => {
      const r = await h.as('admin').patch('/users/viewer', { role: 'editor' }).expect(200);
      expect(r.body.permissions.canManageInventory).toBe(true);
      await h.as('admin').patch('/users/pending', { status: 'approved' }).expect(200);
      await h.as('pending').get('/products').expect(200);
    });

    it('admin não remove o próprio admin nem se exclui', async () => {
      await h.as('admin').patch('/users/admin', { role: 'viewer' }).expect(400);
      await h.as('admin').del('/users/admin').expect(400);
    });

    it('excluir remove do banco e do Cognito', async () => {
      await h.as('admin').del('/users/viewer').expect(204);
      expect(h.cognito.deleteUser).toHaveBeenCalledWith('viewer@x.com');
      expect(await h.db.select().from(users).where(eq(users.id, 'viewer'))).toHaveLength(0);
    });
  });

  describe('access requests', () => {
    const req = { name: 'Maria', email: 'maria@oficina.com', workshopName: 'Oficina da Maria' };

    it('público cria; admin aprova e vira usuário no Cognito', async () => {
      await request(h.app).post('/api/v1/access-requests').send(req).expect(201);
      const [r] = (await h.as('admin').get('/access-requests?status=pending').expect(200)).body;
      const ok = await h.as('admin').post(`/access-requests/${r.id}/approve`, { role: 'viewer' }).expect(200);
      expect(ok.body.user).toMatchObject({ email: 'maria@oficina.com', role: 'viewer', status: 'approved' });
      expect(h.cognito.createUser).toHaveBeenCalledWith('maria@oficina.com', 'Maria');
      expect((await h.as('admin').get('/access-requests?status=pending')).body).toHaveLength(0);
    });

    it('rejeitar; não-admin não lista', async () => {
      await request(h.app).post('/api/v1/access-requests').send(req).expect(201);
      await h.as('editor').get('/access-requests').expect(403);
      const [r] = (await h.as('admin').get('/access-requests')).body;
      await h.as('admin').post(`/access-requests/${r.id}/reject`).expect(200);
    });

    it('valida e-mail', async () => {
      await request(h.app).post('/api/v1/access-requests').send({ ...req, email: 'x' }).expect(400);
    });
  });

  describe('ai searches', () => {
    it('cada usuário vê só o próprio histórico', async () => {
      await h.as('editor').post('/ai-searches', { query: 'q1', response: 'r1' }).expect(201);
      await h.as('viewer').post('/ai-searches', { query: 'q2', response: 'r2' }).expect(201);
      const mine = (await h.as('editor').get('/ai-searches')).body;
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ query: 'q1', userId: 'editor' });
    });

    it('só exclui o próprio histórico', async () => {
      const mine = (await h.as('editor').post('/ai-searches', { query: 'q', response: 'r' })).body;
      await h.as('viewer').del(`/ai-searches/${mine.id}`).expect(204);
      expect((await h.as('editor').get('/ai-searches')).body).toHaveLength(1);
      await h.as('editor').del(`/ai-searches/${mine.id}`).expect(204);
      expect((await h.as('editor').get('/ai-searches')).body).toHaveLength(0);
    });
  });
});
