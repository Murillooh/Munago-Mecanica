import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createHarness } from './test/apiHarness';
import { notifications, products, serviceOrders, transactions, users, workspaces } from './db/schema';

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
      expect(def.body).toMatchObject({ storeName: 'Munago Mecânica', allowNegativeStock: false });
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

    it('público cria; admin geral aprova e o solicitante ganha oficina própria', async () => {
      await request(h.app).post('/api/v1/access-requests').send(req).expect(201);
      const [r] = (await h.as('boss').get('/access-requests?status=pending').expect(200)).body;
      const ok = await h.as('boss').post(`/access-requests/${r.id}/approve`, {}).expect(200);
      expect(ok.body.user).toMatchObject({ email: 'maria@oficina.com', role: 'admin', status: 'approved' });
      expect(ok.body.user.workspaceId).not.toBe('default');
      const [w] = await h.db.select().from(workspaces).where(eq(workspaces.id, ok.body.user.workspaceId));
      expect(w.name).toBe('Oficina da Maria');
      expect(h.cognito.createUser).toHaveBeenCalledWith('maria@oficina.com', 'Maria');
      expect((await h.as('boss').get('/access-requests?status=pending')).body).toHaveLength(0);
    });

    it('rejeitar; só o admin geral lista (admin de oficina não)', async () => {
      await request(h.app).post('/api/v1/access-requests').send(req).expect(201);
      await h.as('editor').get('/access-requests').expect(403);
      await h.as('admin').get('/access-requests').expect(403);
      const [r] = (await h.as('boss').get('/access-requests')).body;
      await h.as('boss').post(`/access-requests/${r.id}/reject`).expect(200);
    });

    it('valida e-mail', async () => {
      await request(h.app).post('/api/v1/access-requests').send({ ...req, email: 'x' }).expect(400);
    });
  });

  describe('isolamento entre oficinas', () => {
    it('outra oficina não vê nem altera produtos, OS, movimentações, categorias e usuários', async () => {
      const p = (await h.as('admin').post('/products', { name: 'Pastilha', quantity: 5, minQuantity: 1 }).expect(201)).body;
      await h.as('admin').post('/categories', { name: 'Freios' }).expect(201);
      const os = (await h.as('admin').post('/service-orders', {
        customerName: 'Ana', scheduledDate: '2026-10-07',
        items: [{ productId: p.id, name: 'Pastilha', quantity: 1, price: 10, total: 10 }],
      }).expect(201)).body;

      for (const path of ['/products', '/categories', '/service-orders', '/transactions', '/notifications']) {
        expect((await h.as('outsider').get(path).expect(200)).body, path).toEqual([]);
      }
      expect((await h.as('outsider').get('/users').expect(200)).body.map((u: { id: string }) => u.id)).toEqual(['outsider']);

      await h.as('outsider').patch(`/products/${p.id}`, { name: 'Hackeado' }).expect(404);
      await h.as('outsider').del(`/products/${p.id}`).expect(204);
      await h.as('outsider').patch(`/service-orders/${os.id}`, { customerName: 'X' }).expect(404);
      await h.as('outsider').del(`/service-orders/${os.id}`).expect(204);
      await h.as('outsider').post('/transactions', { productId: p.id, type: 'out', quantity: 1 }).expect(404);
      await h.as('outsider').patch('/users/editor', { role: 'viewer' }).expect(404);
      await h.as('outsider').del('/users/editor').expect(204);

      const [prod] = await h.db.select().from(products).where(eq(products.id, p.id));
      expect(prod).toMatchObject({ name: 'Pastilha', quantity: 4 });
      expect(await h.db.select().from(serviceOrders)).toHaveLength(1);
      expect(await h.db.select().from(users).where(eq(users.id, 'editor'))).toHaveLength(1);
    });

    it('OS da outra oficina não consegue usar produto alheio', async () => {
      const p = (await h.as('admin').post('/products', { name: 'Vela', quantity: 5, minQuantity: 0 })).body;
      await h.as('outsider').post('/service-orders', {
        customerName: 'Intruso', scheduledDate: '2026-10-07',
        items: [{ productId: p.id, name: 'Vela', quantity: 1, price: 1, total: 1 }],
      }).expect(404);
    });

    it('configurações são por oficina', async () => {
      await h.as('admin').patch('/settings', { storeName: 'Oficina A' }).expect(200);
      expect((await h.as('outsider').get('/settings')).body.storeName).not.toBe('Oficina A');
      const [w] = await h.db.select().from(workspaces).where(eq(workspaces.id, 'default'));
      expect(w.name).toBe('Oficina A');
    });

    it('restaurar backup não sobrescreve produto de outra oficina', async () => {
      const p = (await h.as('admin').post('/products', { name: 'Original', quantity: 1, minQuantity: 0 })).body;
      await h.as('outsider').post('/backups/restore', {
        products: [{ id: p.id, name: 'Sobrescrito', quantity: 0, minQuantity: 0 }], categories: [],
      }).expect(200);
      const [prod] = await h.db.select().from(products).where(eq(products.id, p.id));
      expect(prod).toMatchObject({ name: 'Original', workspaceId: 'default' });
    });

    it('admin geral lista todas as oficinas e opera em qualquer uma', async () => {
      await h.as('outsider').post('/products', { name: 'Da outra', quantity: 1, minQuantity: 0 }).expect(201);
      const all = (await h.as('boss').get('/workspaces').expect(200)).body.map((w: { id: string }) => w.id).sort();
      expect(all).toEqual(['default', 'other']);
      expect((await h.as('admin').get('/workspaces')).body.map((w: { id: string }) => w.id)).toEqual(['default']);

      expect((await h.as('boss').get('/products')).body).toEqual([]);
      const there = (await h.as('boss', 'other').get('/products').expect(200)).body;
      expect(there.map((p: { name: string }) => p.name)).toEqual(['Da outra']);
      const me = (await h.as('boss', 'other').get('/me').expect(200)).body;
      expect(me).toMatchObject({ isSuperAdmin: true, workspace: { id: 'other', name: 'Outra Oficina' } });

      // Admin comum não usa o header para pular de oficina.
      expect((await h.as('outsider', 'default').get('/products')).body.map((p: { name: string }) => p.name)).toEqual(['Da outra']);
    });
  });

  describe('painel do admin geral', () => {
    it('só o admin geral acessa; mostra todas as oficinas com números', async () => {
      await h.as('admin').get('/admin/overview').expect(403);
      await h.as('outsider').get('/admin/overview').expect(403);

      const p = (await h.as('admin').post('/products', { name: 'Pastilha', quantity: 2, minQuantity: 5, price: 10 })).body;
      await h.as('admin').post('/service-orders', {
        customerName: 'Ana', scheduledDate: '2026-10-07', status: 'paid', totalAmount: 150,
        items: [{ productId: p.id, name: 'Pastilha', quantity: 1, price: 10, total: 10 }],
      }).expect(201);

      const { body } = await h.as('boss').get('/admin/overview').expect(200);
      expect(body.totals).toMatchObject({ workspaces: 2, users: 6, products: 1, serviceOrders: 1, revenue: 150 });
      const def = body.workspaces.find((w: { id: string }) => w.id === 'default');
      expect(def).toMatchObject({ productCount: 1, lowStockCount: 1, stockValue: 10, serviceOrderCount: 1, revenue: 150 });
      expect(def.lastActivity).toBeTruthy();
      const other = body.workspaces.find((w: { id: string }) => w.id === 'other');
      expect(other).toMatchObject({ productCount: 0, serviceOrderCount: 0, lastActivity: null });
      expect(other.users.map((u: { email: string }) => u.email)).toEqual(['outsider@y.com']);
    });
  });

  describe('admin geral: renomear e excluir oficina', () => {
    it('renomeia (só admin geral) e sincroniza o nome nas configurações', async () => {
      await h.as('outsider').patch('/admin/workspaces/other', { name: 'X' }).expect(403);
      const res = await h.as('boss').patch('/admin/workspaces/other', { name: 'Oficina Nova' }).expect(200);
      expect(res.body.name).toBe('Oficina Nova');
      expect((await h.as('outsider').get('/settings')).body.storeName).toBe('Oficina Nova');
      await h.as('boss').patch('/admin/workspaces/nao-existe', { name: 'Y' }).expect(404);
    });

    it('exclui com confirmação, apagando dados, usuários e contas de login', async () => {
      await h.as('outsider').post('/products', { name: 'Peça', quantity: 1, minQuantity: 0 }).expect(201);
      await h.as('admin').del('/admin/workspaces/other').send({ confirmName: 'Outra Oficina' }).expect(403);
      const wrong = await h.as('boss').del('/admin/workspaces/other').send({ confirmName: 'outra' }).expect(400);
      expect(wrong.body.code).toBe('CONFIRMATION_MISMATCH');

      await h.as('boss').del('/admin/workspaces/other').send({ confirmName: 'Outra Oficina' }).expect(204);
      expect(await h.db.select().from(workspaces).where(eq(workspaces.id, 'other'))).toHaveLength(0);
      expect(await h.db.select().from(users).where(eq(users.id, 'outsider'))).toHaveLength(0);
      expect(await h.db.select().from(products).where(eq(products.workspaceId, 'other'))).toHaveLength(0);
      expect(h.cognito.deleteUser).toHaveBeenCalledWith('outsider@y.com');
      // Dados da oficina do admin geral continuam.
      expect(await h.db.select().from(users).where(eq(users.id, 'admin'))).toHaveLength(1);
    });

    it('não exclui a própria oficina', async () => {
      const res = await h.as('boss').del('/admin/workspaces/default').send({ confirmName: 'Munago Mecânica' }).expect(400);
      expect(res.body.code).toBe('OWN_WORKSPACE');
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
