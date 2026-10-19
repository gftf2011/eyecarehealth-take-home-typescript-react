import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { ADMIN_TOKEN, bearer } from '../../shared-kernel/presentation/testing/static-authenticator';
import { makeDispatchPlanner, type DispatchPlannerHandle } from '../main/dispatch-planner.factory';

const SIZE = 800;

/**
 * O Húngaro é O(n³): 800 pedidos × 800 entregadores levam perto de 1 s. Se
 * rodasse na thread da API, todas as outras requisições esperariam por ele.
 */
describe('POST /api/orders/optimize-assignment com um problema grande', () => {
  let testApp: TestApp;
  let dispatch: DispatchPlannerHandle;

  beforeAll(async () => {
    dispatch = makeDispatchPlanner({ workers: 1, maxQueued: 2, timeoutMs: 60_000, inlineMaxCells: 10_000 });
    await dispatch.ready();
    testApp = await buildTestApp({ dispatchPlanner: dispatch.planner });
    await resetDatabase(testApp.deliveryDb);
    const db = testApp.deliveryDb as unknown as Kysely<unknown>;
    await sql`
      INSERT INTO delivery_persons (id, name, phone, vehicle_type, is_active, current_latitude, current_longitude)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'Entregador ' || n,
             '(11) 91234-' || lpad((n % 10000)::text, 4, '0'), 'motorcycle', true,
             -23.40 - (n % 97) / 300.0, -46.50 - (n % 89) / 300.0
      FROM generate_series(1, ${SIZE}) AS n
    `.execute(db);
    await sql`
      INSERT INTO orders (id, customer_name, customer_phone, delivery_address, latitude, longitude, status, total_amount)
      SELECT ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, 'Cliente ' || n,
             '(11) 99999-' || lpad((n % 10000)::text, 4, '0'), 'Rua de Teste, ' || n || ', São Paulo - SP',
             -23.45 - (n % 83) / 300.0, -46.55 - (n % 79) / 300.0, 'ready', 45.40
      FROM generate_series(1, ${SIZE}) AS n
    `.execute(db);
  });

  afterAll(async () => {
    await testApp.close();
    await dispatch.close();
  });

  it('a API continua respondendo enquanto a sugestão é calculada', async () => {
    const suggestion = testApp.app.inject({
      method: 'POST',
      url: '/api/orders/optimize-assignment',
      headers: bearer(ADMIN_TOKEN),
    });

    // Enquanto o cálculo roda no worker, o health check responde normalmente.
    const healthLatencies: number[] = [];
    let done = false;
    void suggestion.finally(() => {
      done = true;
    });
    while (!done) {
      const startedAt = performance.now();
      const health = await testApp.app.inject({ method: 'GET', url: '/api/health' });
      healthLatencies.push(performance.now() - startedAt);
      expect(health.statusCode).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const response = await suggestion;
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.assignments).toHaveLength(SIZE);
    // O cálculo foi pesado de verdade, e o health check passou várias vezes por ele.
    expect(body.executionTimeMs).toBeGreaterThan(200);
    expect(healthLatencies.length).toBeGreaterThan(3);
    // Na thread da API, cada chamada esperaria o cálculo inteiro (segundos). Com o
    // worker, respondem em poucos ms; só a primeira divide a thread com a leitura
    // do quadro no banco, antes de o cálculo sair para o worker.
    const sorted = [...healthLatencies].sort((x, y) => x - y);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? Infinity;
    expect(p90).toBeLessThan(50);
    expect(Math.max(...healthLatencies)).toBeLessThan(body.executionTimeMs / 2);
  });
});
