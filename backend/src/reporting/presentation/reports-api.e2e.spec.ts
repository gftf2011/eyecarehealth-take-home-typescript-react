import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';
import { insertProduct } from '../../ordering/infra/persistence/testing/ordering-test-data';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import {
  ADMIN_TOKEN,
  bearer,
  VIEWER_TOKEN,
} from '../../shared-kernel/presentation/testing/static-authenticator';

const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const JUICE_ID = '7a1c9e2b-4d3f-4a6b-8c9d-1e2f3a4b5c6d';
const MINUTE = 60_000;

describe('API de relatórios (/api/reports)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.orderingDb);
    // 01/02/2025 09:00 em São Paulo.
    testApp.clock.setTo(new Date('2025-02-01T12:00:00Z'));
    const raw = testApp.orderingDb as unknown as Kysely<unknown>;
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  function request(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object, token = ADMIN_TOKEN) {
    return testApp.app.inject({ method, url, headers: bearer(token), ...(payload && { payload }) });
  }

  async function courier(vehicleType: 'motorcycle' | 'bicycle'): Promise<string> {
    const response = await request('POST', '/api/delivery-persons', {
      name: `Entregador ${vehicleType}`,
      phone: '(11) 91234-5678',
      vehicleType,
    });
    return response.json().id;
  }

  async function placeOrder(items: { productId: string; quantity: number }[]): Promise<string> {
    const response = await request('POST', '/api/orders', {
      customerName: 'Maria Oliveira',
      customerPhone: '(21) 98765-4321',
      deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
      latitude: -22.9068,
      longitude: -43.1729,
      items,
    });
    return response.json().id;
  }

  /** Cria e entrega um pedido pela API; a entrega leva `minutes` minutos. */
  async function deliverOrder(
    items: { productId: string; quantity: number }[],
    deliveryPersonId: string,
    minutes: number,
  ): Promise<string> {
    const id = await placeOrder(items);
    await request('PATCH', `/api/orders/${id}/status`, { status: 'preparing' });
    await request('PATCH', `/api/orders/${id}/status`, { status: 'ready' });
    await request('POST', `/api/orders/${id}/dispatch`, { deliveryPersonId });
    testApp.clock.advanceBy(minutes * MINUTE);
    const delivered = await request('PATCH', `/api/orders/${id}/status`, { status: 'delivered' });
    expect(delivered.statusCode).toBe(200);
    return id;
  }

  /** Dois pedidos entregues por moto (30 e 50 min) e um por bicicleta (20 min), mais um pendente. */
  async function givenSales(): Promise<void> {
    const moto = await courier('motorcycle');
    const bike = await courier('bicycle');
    await deliverOrder([{ productId: BURGER_ID, quantity: 2 }], moto, 30); // 65,80
    await deliverOrder([{ productId: JUICE_ID, quantity: 3 }], moto, 50); // 37,50
    await deliverOrder([{ productId: BURGER_ID, quantity: 1 }], bike, 20); // 32,90
    await placeOrder([{ productId: JUICE_ID, quantity: 10 }]); // pendente: não conta
  }

  describe('GET /api/reports/revenue', () => {
    it('receita por período: soma os entregues, com ticket médio e série diária', async () => {
      await givenSales();

      const response = await request('GET', '/api/reports/revenue?startDate=2025-01-31&endDate=2025-02-01');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        startDate: '2025-01-31',
        endDate: '2025-02-01',
        totalRevenue: 136.2,
        totalOrders: 3,
        averageOrderValue: 45.4,
        dailyRevenue: [
          { date: '2025-01-31', revenue: 0, orders: 0 },
          { date: '2025-02-01', revenue: 136.2, orders: 3 },
        ],
      });
    });

    it('400 sem as datas obrigatórias', async () => {
      const response = await request('GET', '/api/reports/revenue');

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual([
        { field: 'startDate', message: 'Campo obrigatório' },
        { field: 'endDate', message: 'Campo obrigatório' },
      ]);
    });

    it('400 para período maior que 366 dias', async () => {
      const response = await request('GET', '/api/reports/revenue?startDate=2024-01-01&endDate=2025-06-30');

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details[0]).toMatchObject({ field: 'endDate' });
    });
  });

  describe('GET /api/reports/top-products', () => {
    it('produtos mais vendidos: ranking por quantidade, só pedidos entregues', async () => {
      await givenSales();

      const response = await request('GET', '/api/reports/top-products');

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [
          { productId: BURGER_ID, productName: 'X-Burger Especial', totalQuantity: 3, totalRevenue: 98.7 },
          { productId: JUICE_ID, productName: 'Suco de Laranja', totalQuantity: 3, totalRevenue: 37.5 },
        ],
      });
    });

    it('respeita limit e rejeita limit fora da faixa', async () => {
      await givenSales();

      const top1 = await request('GET', '/api/reports/top-products?limit=1');
      const invalid = await request('GET', '/api/reports/top-products?limit=0');

      expect(top1.json().data).toHaveLength(1);
      expect(invalid.statusCode).toBe(400);
    });
  });

  describe('GET /api/reports/orders-by-status', () => {
    it('conta todos os status, com zero onde não há pedidos', async () => {
      await givenSales();

      const response = await request('GET', '/api/reports/orders-by-status');

      expect(response.json()).toEqual({
        data: [
          { status: 'pending', count: 1 },
          { status: 'preparing', count: 0 },
          { status: 'ready', count: 0 },
          { status: 'delivering', count: 0 },
          { status: 'delivered', count: 3 },
          { status: 'cancelled', count: 0 },
        ],
        total: 4,
      });
    });
  });

  describe('GET /api/reports/average-delivery-time', () => {
    it('média geral e por veículo, da criação à entrega', async () => {
      await givenSales();

      const response = await request('GET', '/api/reports/average-delivery-time');

      expect(response.statusCode).toBe(200);
      // Cada pedido é criado após o anterior ser entregue (relógio avança): os
      // tempos são exatamente 30, 50 e 20 minutos.
      expect(response.json()).toEqual({
        averageMinutes: 33.3,
        fastestMinutes: 20,
        slowestMinutes: 50,
        totalDelivered: 3,
        byVehicleType: [
          { vehicleType: 'motorcycle', averageMinutes: 40, fastestMinutes: 30, slowestMinutes: 50, count: 2 },
          { vehicleType: 'bicycle', averageMinutes: 20, fastestMinutes: 20, slowestMinutes: 20, count: 1 },
        ],
      });
    });
  });

  describe('autorização', () => {
    it.each([
      '/api/reports/revenue?startDate=2025-02-01&endDate=2025-02-01',
      '/api/reports/orders-by-status',
      '/api/reports/top-products',
      '/api/reports/average-delivery-time',
    ])('viewer lê %s', async (url) => {
      expect((await request('GET', url, undefined, VIEWER_TOKEN)).statusCode).toBe(200);
    });

    it('401 sem token', async () => {
      const response = await testApp.app.inject({ method: 'GET', url: '/api/reports/orders-by-status' });

      expect(response.statusCode).toBe(401);
    });
  });
});
