import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import {
  ADMIN_TOKEN,
  bearer,
  VIEWER_TOKEN,
} from '../../shared-kernel/presentation/testing/static-authenticator';
import { insertDeliveryPerson, insertProduct } from '../infra/persistence/testing/ordering-test-data';

const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const PUDDING_ID = '7a1c9e2b-4d3f-4a6b-8c9d-1e2f3a4b5c6d';
const COURIER_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';
const DAY_MS = 24 * 60 * 60 * 1000;

const newOrder = {
  customerName: 'Maria Oliveira',
  customerPhone: '(21) 98765-4321',
  deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
  latitude: -22.9068,
  longitude: -43.1729,
  items: [{ productId: BURGER_ID, quantity: 2 }],
};

describe('API de pedidos (/api/orders)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.orderingDb);
    testApp.clock.setTo(new Date('2025-02-01T12:00:00Z'));
    const raw = testApp.orderingDb as unknown as Kysely<unknown>;
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: PUDDING_ID, name: 'Pudim de Leite', price: '9.00', isAvailable: false });
    await insertDeliveryPerson(raw, { id: COURIER_ID, name: 'Carlos Santos' });
    await insertDeliveryPerson(raw, { id: OTHER_COURIER_ID, name: 'Ana Lima' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  function request(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
    token = ADMIN_TOKEN,
  ) {
    return testApp.app.inject({ method, url, headers: bearer(token), ...(payload && { payload }) });
  }

  async function placeOrder(payload: object = newOrder): Promise<string> {
    const response = await request('POST', '/api/orders', payload);
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  const changeStatus = (id: string, status: string) =>
    request('PATCH', `/api/orders/${id}/status`, { status });
  const assign = (id: string, deliveryPersonId: string) =>
    request('PATCH', `/api/orders/${id}/assign`, { deliveryPersonId });

  /** Leva um pedido novo até `ready`. */
  async function readyOrder(): Promise<string> {
    const id = await placeOrder();
    await changeStatus(id, 'preparing');
    await changeStatus(id, 'ready');
    return id;
  }

  describe('POST /api/orders', () => {
    it('201: cria o pedido pending com o total calculado pelo backend', async () => {
      const response = await request('POST', '/api/orders', { ...newOrder, totalAmount: 1 });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        customerName: 'Maria Oliveira',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        status: 'pending',
        totalAmount: 65.8,
        deliveryPerson: null,
        items: [
          {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            product: { id: BURGER_ID, name: 'X-Burger Especial' },
            quantity: 2,
            unitPrice: 32.9,
          },
        ],
        statusHistory: [{ from: null, to: 'pending', changedAt: '2025-02-01T12:00:00.000Z', reason: null }],
        createdAt: '2025-02-01T12:00:00.000Z',
        updatedAt: '2025-02-01T12:00:00.000Z',
      });
    });

    it('grava a atualização do pedido no outbox para o painel em tempo real', async () => {
      const id = await placeOrder();

      const outbox = await testApp.orderingDb.selectFrom('outbox_events').select(['event_name', 'payload']).execute();
      expect(outbox).toEqual([
        {
          event_name: 'ordering.order-updates',
          payload: expect.objectContaining({ type: 'order.placed', orderId: id, totalAmount: 65.8 }),
        },
      ]);
    });

    it('400 VALIDATION_ERROR listando todos os campos inválidos', async () => {
      const response = await request('POST', '/api/orders', {
        ...newOrder,
        customerName: 'Jo',
        customerPhone: '21987654321',
        items: [{ productId: 'abc', quantity: 0 }],
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: [
            { field: 'customerName', message: 'O nome do cliente deve ter entre 3 e 100 caracteres' },
            { field: 'customerPhone', message: 'O telefone deve estar no formato (XX) XXXXX-XXXX' },
            { field: 'items.0.productId', message: "O identificador 'abc' não é um UUID válido" },
            { field: 'items.0.quantity', message: 'A quantidade deve ser um inteiro maior que zero' },
          ],
        },
      });
    });

    it('400 quando o corpo tem tipos errados ou campos ausentes', async () => {
      const response = await request('POST', '/api/orders', { customerName: 'Maria', latitude: '-22.9' });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.details.map((detail: { field: string }) => detail.field)).toEqual(
        expect.arrayContaining(['customerPhone', 'latitude', 'items']),
      );
    });

    it('422 UNAVAILABLE_PRODUCT para produto indisponível', async () => {
      const response = await request('POST', '/api/orders', {
        ...newOrder,
        items: [{ productId: PUDDING_ID, quantity: 1 }],
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({
        error: {
          code: 'UNAVAILABLE_PRODUCT',
          message: 'Um ou mais produtos não estão disponíveis',
          details: [{ productId: PUDDING_ID, productName: 'Pudim de Leite', reason: 'Produto indisponível' }],
        },
      });
    });

    it('422 UNAVAILABLE_PRODUCT para produto inexistente', async () => {
      const response = await request('POST', '/api/orders', {
        ...newOrder,
        items: [{ productId: UNKNOWN_ID, quantity: 1 }],
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().error.details).toEqual([
        { productId: UNKNOWN_ID, productName: null, reason: 'Produto não encontrado' },
      ]);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('percorre o fluxo completo até delivered, com entregador atribuído', async () => {
      const id = await readyOrder();

      const assigned = await assign(id, COURIER_ID);
      const dispatched = await changeStatus(id, 'delivering');
      const delivered = await changeStatus(id, 'delivered');

      expect(assigned.statusCode).toBe(200);
      expect(assigned.json()).toMatchObject({
        status: 'ready',
        deliveryPerson: { id: COURIER_ID, name: 'Carlos Santos' },
      });
      expect(dispatched.json().status).toBe('delivering');
      expect(delivered.statusCode).toBe(200);
      expect(delivered.json()).toMatchObject({
        status: 'delivered',
        deliveryPerson: { id: COURIER_ID, name: 'Carlos Santos' },
      });
    });

    it('200 em transição válida (pending → preparing)', async () => {
      const id = await placeOrder();

      const response = await changeStatus(id, 'preparing');

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('preparing');
    });

    it.each([
      ['pending', 'ready'],
      ['pending', 'delivered'],
    ])('422 INVALID_STATUS_TRANSITION em %s → %s', async (from, to) => {
      const id = await placeOrder();

      const response = await changeStatus(id, to);

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Não é possível alterar o status de '${from}' para '${to}'`,
          details: [{ from, to }],
        },
      });
    });

    it('422 ao tentar voltar um pedido entregue (delivered → pending)', async () => {
      const id = await readyOrder();
      await assign(id, COURIER_ID);
      await changeStatus(id, 'delivering');
      await changeStatus(id, 'delivered');

      const response = await changeStatus(id, 'pending');

      expect(response.statusCode).toBe(422);
      expect(response.json().error.message).toBe("Não é possível alterar o status de 'delivered' para 'pending'");
    });

    it('422 ao despachar sem entregador atribuído', async () => {
      const id = await readyOrder();

      const response = await changeStatus(id, 'delivering');

      expect(response.statusCode).toBe(422);
      expect(response.json().error.message).toMatch(/é obrigatório ter um entregador atribuído/);
    });

    it('422 DELIVERY_PERSON_UNAVAILABLE ao despachar entregador já em outra entrega', async () => {
      const first = await readyOrder();
      const second = await readyOrder();
      await assign(first, COURIER_ID);
      await assign(second, COURIER_ID);
      await changeStatus(first, 'delivering');

      const response = await changeStatus(second, 'delivering');

      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('DELIVERY_PERSON_UNAVAILABLE');
    });

    it('400 para status desconhecido e 404 para pedido inexistente', async () => {
      const id = await placeOrder();

      const invalid = await changeStatus(id, 'shipped');
      const missing = await changeStatus(UNKNOWN_ID, 'preparing');

      expect(invalid.statusCode).toBe(400);
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('POST /api/orders/:id/return-to-assignment', () => {
    const returnToAssignment = (id: string, reason: unknown, token = ADMIN_TOKEN) =>
      request('POST', `/api/orders/${id}/return-to-assignment`, { reason }, token);

    async function deliveringOrder(): Promise<string> {
      const id = await readyOrder();
      await assign(id, COURIER_ID);
      await changeStatus(id, 'delivering');
      return id;
    }

    it('200: a entrega volta para ready, sem entregador, com o motivo no histórico; o entregador fica livre', async () => {
      const id = await deliveringOrder();
      testApp.clock.setTo(new Date('2025-02-01T12:40:00Z'));

      const returned = await returnToAssignment(id, 'Entregador sem contato há 30 minutos');

      expect(returned.statusCode).toBe(200);
      expect(returned.json()).toMatchObject({ status: 'ready', deliveryPerson: null });
      expect(returned.json().statusHistory.at(-1)).toEqual({
        from: 'delivering',
        to: 'ready',
        changedAt: '2025-02-01T12:40:00.000Z',
        reason: 'Entregador sem contato há 30 minutos',
      });
      // Livre: pode assumir outra entrega na hora.
      const other = await readyOrder();
      expect((await assign(other, COURIER_ID)).statusCode).toBe(200);
    });

    it('422 INVALID_STATUS_TRANSITION se o pedido não está em entrega', async () => {
      const id = await readyOrder();

      const response = await returnToAssignment(id, 'Entregador sem contato');

      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('400 sem motivo válido, 403 para o viewer e 404 para pedido inexistente', async () => {
      const id = await deliveringOrder();

      const short = await returnToAssignment(id, 'ab');
      const missing = await request('POST', `/api/orders/${id}/return-to-assignment`, {});
      const viewer = await returnToAssignment(id, 'Entregador sem contato', VIEWER_TOKEN);
      const unknown = await returnToAssignment('c0ffee00-1234-4abc-8def-0123456789ab', 'Entregador sem contato');

      expect(short.statusCode).toBe(400);
      expect(short.json().error.details).toEqual([{ field: 'reason', message: 'O motivo deve ter entre 3 e 200 caracteres' }]);
      expect(missing.statusCode).toBe(400);
      expect(viewer.statusCode).toBe(403);
      expect(unknown.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/orders/:id/assign', () => {
    it('422 DELIVERY_PERSON_UNAVAILABLE para entregador com entrega em andamento', async () => {
      const busy = await readyOrder();
      await assign(busy, COURIER_ID);
      await changeStatus(busy, 'delivering');
      const other = await readyOrder();

      const response = await assign(other, COURIER_ID);

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({
        error: {
          code: 'DELIVERY_PERSON_UNAVAILABLE',
          message: 'Este entregador já está atribuído a outro pedido em andamento',
          details: [{ deliveryPersonId: COURIER_ID }],
        },
      });
    });

    it('404 DELIVERY_PERSON_NOT_FOUND para entregador inexistente', async () => {
      const id = await placeOrder();

      const response = await assign(id, UNKNOWN_ID);

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('DELIVERY_PERSON_NOT_FOUND');
    });
  });

  describe('GET /api/orders', () => {
    it('lista com paginação, mais recentes primeiro', async () => {
      const first = await placeOrder();
      testApp.clock.advanceBy(60_000);
      const second = await placeOrder();

      const response = await request('GET', '/api/orders?limit=1');

      expect(response.statusCode).toBe(200);
      expect(response.json().data.map((order: { id: string }) => order.id)).toEqual([second]);
      expect(response.json().pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      expect(first).not.toBe(second);
    });

    it('filtra por status e por dia de criação', async () => {
      const yesterday = await placeOrder();
      testApp.clock.advanceBy(DAY_MS);
      const today = await placeOrder();
      await changeStatus(today, 'preparing');

      const byStatus = await request('GET', '/api/orders?status=preparing');
      const byDay = await request('GET', '/api/orders?startDate=2025-02-01&endDate=2025-02-01');

      expect(byStatus.json().data.map((order: { id: string }) => order.id)).toEqual([today]);
      expect(byDay.json().data.map((order: { id: string }) => order.id)).toEqual([yesterday]);
    });

    it('400 para parâmetros de consulta inválidos', async () => {
      const response = await request('GET', '/api/orders?limit=500&sortBy=customerName');

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details.map((detail: { field: string }) => detail.field)).toEqual([
        'limit',
        'sortBy',
      ]);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('devolve o detalhe e 404 para pedido inexistente', async () => {
      const id = await placeOrder();

      const found = await request('GET', `/api/orders/${id}`);
      const missing = await request('GET', `/api/orders/${UNKNOWN_ID}`);

      expect(found.statusCode).toBe(200);
      expect(found.json()).toMatchObject({ id, status: 'pending', totalAmount: 65.8 });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({
        error: { code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado', details: [{ orderId: UNKNOWN_ID }] },
      });
    });
  });

  describe('autorização', () => {
    it('viewer lê pedidos, mas não cria nem altera (403)', async () => {
      const id = await placeOrder();

      const list = await request('GET', '/api/orders', undefined, VIEWER_TOKEN);
      const detail = await request('GET', `/api/orders/${id}`, undefined, VIEWER_TOKEN);
      const create = await request('POST', '/api/orders', newOrder, VIEWER_TOKEN);
      const status = await request('PATCH', `/api/orders/${id}/status`, { status: 'preparing' }, VIEWER_TOKEN);
      const assignment = await request(
        'PATCH',
        `/api/orders/${id}/assign`,
        { deliveryPersonId: COURIER_ID },
        VIEWER_TOKEN,
      );

      expect([list.statusCode, detail.statusCode]).toEqual([200, 200]);
      expect([create.statusCode, status.statusCode, assignment.statusCode]).toEqual([403, 403, 403]);
      expect(create.json().error.code).toBe('FORBIDDEN');
    });

    it('401 sem token', async () => {
      const response = await testApp.app.inject({ method: 'GET', url: '/api/orders' });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('INVALID_TOKEN');
    });
  });
});
