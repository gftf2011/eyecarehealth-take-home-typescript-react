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
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

const carlos = {
  name: 'Carlos Santos',
  phone: '(11) 91234-5678',
  vehicleType: 'motorcycle',
  currentLatitude: -23.5489,
  currentLongitude: -46.6388,
};

describe('API de entregadores (/api/delivery-persons)', () => {
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

  function request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
    token = ADMIN_TOKEN,
  ) {
    return testApp.app.inject({ method, url, headers: bearer(token), ...(payload && { payload }) });
  }

  async function register(payload: object = carlos): Promise<string> {
    const response = await request('POST', '/api/delivery-persons', payload);
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  /** Cria um pedido e o leva até `delivering` com o entregador informado. */
  async function deliveringOrderWith(deliveryPersonId: string): Promise<string> {
    const placed = await request('POST', '/api/orders', {
      customerName: 'Maria Oliveira',
      customerPhone: '(21) 98765-4321',
      deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
      latitude: -22.9068,
      longitude: -43.1729,
      items: [{ productId: BURGER_ID, quantity: 1 }],
    });
    const orderId: string = placed.json().id;
    await request('PATCH', `/api/orders/${orderId}/status`, { status: 'preparing' });
    await request('PATCH', `/api/orders/${orderId}/status`, { status: 'ready' });
    await request('PATCH', `/api/orders/${orderId}/assign`, { deliveryPersonId });
    const dispatched = await request('PATCH', `/api/orders/${orderId}/status`, { status: 'delivering' });
    expect(dispatched.statusCode).toBe(200);
    return orderId;
  }

  describe('POST', () => {
    it('201: cadastra o entregador ativo', async () => {
      const response = await request('POST', '/api/delivery-persons', carlos);

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        ...carlos,
        isActive: true,
        currentOrderId: null,
        createdAt: '2025-02-01T12:00:00.000Z',
        updatedAt: '2025-02-01T12:00:00.000Z',
      });
    });

    it('400 listando todos os campos inválidos', async () => {
      const response = await request('POST', '/api/delivery-persons', {
        name: 'Jo',
        phone: '11912345678',
        vehicleType: 'truck',
        currentLatitude: -23.5,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details.map((detail: { field: string }) => detail.field)).toEqual([
        'name',
        'phone',
        'vehicleType',
        'currentLongitude',
      ]);
    });
  });

  describe('PUT', () => {
    it('atualiza só os campos enviados, inclusive a localização', async () => {
      const id = await register();

      const response = await request('PUT', `/api/delivery-persons/${id}`, {
        isActive: false,
        currentLatitude: null,
        currentLongitude: null,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'Carlos Santos',
        isActive: false,
        currentLatitude: null,
        currentLongitude: null,
      });
    });

    it('404 para entregador inexistente', async () => {
      const response = await request('PUT', `/api/delivery-persons/${UNKNOWN_ID}`, { isActive: false });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('DELIVERY_PERSON_NOT_FOUND');
    });
  });

  describe('DELETE', () => {
    it('204 e depois 404 (soft delete)', async () => {
      const id = await register();

      const removed = await request('DELETE', `/api/delivery-persons/${id}`);
      const again = await request('DELETE', `/api/delivery-persons/${id}`);

      expect(removed.statusCode).toBe(204);
      expect(removed.body).toBe('');
      expect(again.statusCode).toBe(404);
    });

    it('409 DELIVERY_PERSON_IN_USE com pedido delivering', async () => {
      const id = await register();
      await deliveringOrderWith(id);

      const response = await request('DELETE', `/api/delivery-persons/${id}`);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: 'DELIVERY_PERSON_IN_USE',
          message:
            "Não é possível remover este entregador pois ele está atribuído a um pedido com status 'delivering'",
          details: [{ deliveryPersonId: id }],
        },
      });
    });
  });

  describe('GET', () => {
    it('lista com filtros isActive e available e o pedido em andamento', async () => {
      const busy = await register({ ...carlos, name: 'Bruno Ocupado' });
      const free = await register({ ...carlos, name: 'Ana Livre' });
      await register({ ...carlos, name: 'Carla Inativa', isActive: false });
      const orderId = await deliveringOrderWith(busy);

      const all = await request('GET', '/api/delivery-persons');
      const candidates = await request('GET', '/api/delivery-persons?isActive=true&available=true');

      expect(all.statusCode).toBe(200);
      expect(all.json().data.map((person: { name: string; currentOrderId: string | null }) => [
        person.name,
        person.currentOrderId,
      ])).toEqual([
        ['Ana Livre', null],
        ['Bruno Ocupado', orderId],
        ['Carla Inativa', null],
      ]);
      expect(candidates.json().data.map((person: { id: string }) => person.id)).toEqual([free]);
    });

    it('400 para booleano inválido na query', async () => {
      const response = await request('GET', '/api/delivery-persons?available=sim');

      expect(response.statusCode).toBe(400);
    });
  });

  describe('autorização', () => {
    it('viewer não acessa entregadores (403); sem token, 401', async () => {
      const list = await request('GET', '/api/delivery-persons', undefined, VIEWER_TOKEN);
      const create = await request('POST', '/api/delivery-persons', carlos, VIEWER_TOKEN);
      const anonymous = await testApp.app.inject({ method: 'GET', url: '/api/delivery-persons' });

      expect([list.statusCode, create.statusCode]).toEqual([403, 403]);
      expect(anonymous.statusCode).toBe(401);
    });
  });
});
