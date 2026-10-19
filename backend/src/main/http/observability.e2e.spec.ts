import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { insertProduct } from '../../ordering/infra/persistence/testing/ordering-test-data';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { installInMemoryMetrics } from '../../shared-kernel/infra/observability/testing/in-memory-telemetry';
import { ADMIN_TOKEN, bearer } from '../../shared-kernel/presentation/testing/static-authenticator';
import { buildTestApp, type TestApp } from './testing/build-test-app';

const telemetry = installInMemoryMetrics();
const PRODUCT_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const UNAVAILABLE_ID = '4a3c9d2f-7b5e-4f9a-8c2b-1d3e5f7a9b0c';

describe('Métricas da API (OpenTelemetry)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
    await resetDatabase(testApp.orderingDb);
    const raw = testApp.orderingDb as unknown as Kysely<unknown>;
    await insertProduct(raw, { id: PRODUCT_ID });
    await insertProduct(raw, { id: UNAVAILABLE_ID, name: 'Esgotado', isAvailable: false });
  });

  afterAll(async () => {
    await testApp.close();
  });

  const placeOrder = (productId: string) =>
    testApp.app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: bearer(ADMIN_TOKEN),
      payload: {
        customerName: 'Maria Oliveira',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        items: [{ productId, quantity: 1 }],
      },
    });

  it('mede cada resposta pela rota (sem o id), método e status, e conta só pedidos confirmados', async () => {
    expect((await placeOrder(PRODUCT_ID)).statusCode).toBe(201);
    expect((await placeOrder(UNAVAILABLE_ID)).statusCode).toBe(422);
    const unknownOrder = randomUUID();
    expect((await testApp.app.inject({ method: 'GET', url: `/api/orders/${unknownOrder}`, headers: bearer(ADMIN_TOKEN) })).statusCode).toBe(404);

    const http = await telemetry.points('fastmeals.http.server.request.duration');
    const series = http.map((point) => point.attributes);
    expect(series).toEqual(
      expect.arrayContaining([
        { 'http.request.method': 'POST', 'http.route': '/api/orders', 'http.response.status_code': 201 },
        { 'http.request.method': 'POST', 'http.route': '/api/orders', 'http.response.status_code': 422 },
        { 'http.request.method': 'GET', 'http.route': '/api/orders/:id', 'http.response.status_code': 404 },
      ]),
    );
    expect(JSON.stringify(series)).not.toContain(unknownOrder);

    // O pedido recusado (produto indisponível) não chegou ao commit: não conta.
    const placed = await telemetry.points('fastmeals.orders.placed');
    expect(placed.map((point) => point.value)).toEqual([1]);
  });
});
