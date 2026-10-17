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

  describe('aceitar a sugestão (POST /api/orders/:id/dispatch)', () => {
    type Suggested = { orderId: string; deliveryPersonId: string };

    it('fluxo da tela de atribuição: sugerir, aceitar cada atribuição e ver os pedidos em delivering', async () => {
      await courier('Carlos Santos', -23.5614, -46.6559);
      await courier('Ana Lima', -23.5665, -46.6936);
      await readyOrder('Av. Paulista, 1000, São Paulo - SP', -23.5631, -46.6544);
      await readyOrder('Rua dos Pinheiros, 500, São Paulo - SP', -23.5672, -46.6911);
      const { assignments } = (await request('POST', URL)).json() as { assignments: Suggested[] };

      const accepted = await Promise.all(
        assignments.map((a) =>
          request('POST', `/api/orders/${a.orderId}/dispatch`, { deliveryPersonId: a.deliveryPersonId }),
        ),
      );

      expect(accepted.map((response) => response.statusCode)).toEqual([200, 200]);
      expect(accepted.map((response) => response.json().status)).toEqual(['delivering', 'delivering']);
      // Com todos despachados, uma nova sugestão não tem mais o que atribuir.
      expect((await request('POST', URL)).json()).toMatchObject({ assignments: [], unassigned: [] });
    });

    it('sugestão velha: entregador despachado em outro pedido antes do aceite → 422', async () => {
      // Um entregador, dois pedidos: um é sugerido, o outro fica em `unassigned`.
      await courier('Carlos Santos', -23.5614, -46.6559);
      await readyOrder('Av. Paulista, 1000, São Paulo - SP', -23.5631, -46.6544);
      await readyOrder('Av. Paulista, 2000, São Paulo - SP', -23.5600, -46.6600);
      const body = (await request('POST', URL)).json();
      const suggested = body.assignments[0] as Suggested;
      const otherOrder: string = body.unassigned[0].orderId;

      // Alguém despacha o entregador no outro pedido entre a sugestão e o aceite.
      const first = await request('POST', `/api/orders/${otherOrder}/dispatch`, {
        deliveryPersonId: suggested.deliveryPersonId,
      });
      const stale = await request('POST', `/api/orders/${suggested.orderId}/dispatch`, {
        deliveryPersonId: suggested.deliveryPersonId,
      });

      expect(first.statusCode).toBe(200);
      expect(stale.statusCode).toBe(422);
      expect(stale.json().error.code).toBe('DELIVERY_PERSON_UNAVAILABLE');
    });

    it('pedido que não está ready → 422 INVALID_STATUS_TRANSITION', async () => {
      const id = await courier('Carlos Santos', -23.5614, -46.6559);
      const placed = await request('POST', '/api/orders', {
        customerName: 'Maria Oliveira',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Paulista, 1000, São Paulo - SP',
        latitude: -23.5631,
        longitude: -46.6544,
        items: [{ productId: BURGER_ID, quantity: 1 }],
      });

      const response = await request('POST', `/api/orders/${placed.json().id}/dispatch`, {
        deliveryPersonId: id,
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().error).toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        message: "Não é possível alterar o status de 'pending' para 'delivering'",
      });
    });

    it('viewer não pode despachar (403)', async () => {
      const id = await courier('Carlos Santos', -23.5614, -46.6559);
      const order = await readyOrder('Av. Paulista, 1000, São Paulo - SP', -23.5631, -46.6544);

      const response = await request('POST', `/api/orders/${order}/dispatch`, { deliveryPersonId: id }, VIEWER_TOKEN);

      expect(response.statusCode).toBe(403);
    });
  });

  it('viewer não pode otimizar (403)', async () => {
    const response = await request('POST', URL, undefined, VIEWER_TOKEN);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });
});
