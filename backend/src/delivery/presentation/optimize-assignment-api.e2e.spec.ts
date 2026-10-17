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
const URL = '/api/orders/optimize-assignment';

describe('POST /api/orders/optimize-assignment', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.deliveryDb);
    await insertProduct(testApp.deliveryDb as unknown as Kysely<unknown>, { id: BURGER_ID });
  });

  afterAll(async () => {
    await testApp.close();
  });

  function request(method: 'POST' | 'PATCH', url: string, payload?: object, token = ADMIN_TOKEN) {
    return testApp.app.inject({ method, url, headers: bearer(token), ...(payload && { payload }) });
  }

  async function courier(name: string, latitude: number | null, longitude: number | null): Promise<string> {
    const response = await request('POST', '/api/delivery-persons', {
      name,
      phone: '(11) 91234-5678',
      vehicleType: 'motorcycle',
      currentLatitude: latitude,
      currentLongitude: longitude,
    });
    return response.json().id;
  }

  /** Pedido `ready` no endereço e coordenadas informados. */
  async function readyOrder(address: string, latitude: number, longitude: number): Promise<string> {
    const placed = await request('POST', '/api/orders', {
      customerName: 'Maria Oliveira',
      customerPhone: '(21) 98765-4321',
      deliveryAddress: address,
      latitude,
      longitude,
      items: [{ productId: BURGER_ID, quantity: 1 }],
    });
    const id: string = placed.json().id;
    await request('PATCH', `/api/orders/${id}/status`, { status: 'preparing' });
    await request('PATCH', `/api/orders/${id}/status`, { status: 'ready' });
    return id;
  }

  it('caso com solução: cada pedido vai para o entregador mais próximo no ótimo global', async () => {
    // Entregadores perto da Paulista e de Pinheiros; pedidos ao lado de cada um.
    const paulistaCourier = await courier('Carlos Santos', -23.5614, -46.6559);
    const pinheirosCourier = await courier('Ana Lima', -23.5665, -46.6936);
    const paulistaOrder = await readyOrder('Av. Paulista, 1000, São Paulo - SP', -23.5631, -46.6544);
    const pinheirosOrder = await readyOrder('Rua dos Pinheiros, 500, São Paulo - SP', -23.5672, -46.6911);

    const response = await request('POST', URL);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assignments).toEqual(
      expect.arrayContaining([
        {
          orderId: paulistaOrder,
          deliveryPersonId: paulistaCourier,
          estimatedDistanceKm: expect.any(Number),
          orderAddress: 'Av. Paulista, 1000, São Paulo - SP',
          deliveryPersonName: 'Carlos Santos',
        },
        {
          orderId: pinheirosOrder,
          deliveryPersonId: pinheirosCourier,
          estimatedDistanceKm: expect.any(Number),
          orderAddress: 'Rua dos Pinheiros, 500, São Paulo - SP',
          deliveryPersonName: 'Ana Lima',
        },
      ]),
    );
    expect(body.assignments).toHaveLength(2);
    expect(body.assignments.every((a: { estimatedDistanceKm: number }) => a.estimatedDistanceKm < 1)).toBe(true);
    expect(body).toMatchObject({ unassigned: [], unlocatedDeliveryPersons: [], algorithm: 'hungarian' });
    expect(body.totalDistanceKm).toBeCloseTo(
      body.assignments.reduce((sum: number, a: { estimatedDistanceKm: number }) => sum + a.estimatedDistanceKm, 0),
      2,
    );
    expect(body.executionTimeMs).toEqual(expect.any(Number));
  });

  it('sem entregadores disponíveis: todos os pedidos em unassigned', async () => {
    const order = await readyOrder('Av. Paulista, 1000, São Paulo - SP', -23.5631, -46.6544);
    await courier('Sem GPS', null, null);

    const body = (await request('POST', URL)).json();

    expect(body.assignments).toEqual([]);
    expect(body.unassigned).toEqual([
      { orderId: order, orderAddress: 'Av. Paulista, 1000, São Paulo - SP', reason: 'No available delivery person' },
    ]);
    expect(body.unlocatedDeliveryPersons).toEqual([{ id: expect.any(String), name: 'Sem GPS' }]);
    expect(body.totalDistanceKm).toBe(0);
  });

  it('sem pedidos prontos: resposta vazia', async () => {
    await courier('Carlos Santos', -23.5614, -46.6559);

    const body = (await request('POST', URL)).json();

    expect(body).toMatchObject({ assignments: [], unassigned: [], totalDistanceKm: 0, algorithm: 'hungarian' });
  });

  it('viewer não pode otimizar (403)', async () => {
    const response = await request('POST', URL, undefined, VIEWER_TOKEN);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });
});
