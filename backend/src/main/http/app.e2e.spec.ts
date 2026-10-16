import { afterEach, describe, expect, it } from 'vitest';

import type { Route } from '../../shared-kernel/presentation';
import { ADMIN_TOKEN, bearer } from '../../shared-kernel/presentation/testing/static-authenticator';
import { buildTestApp, type TestApp } from './testing/build-test-app';

/** Rota de teste que falha com um erro inesperado (bug). */
const brokenRoute: Route = {
  method: 'GET',
  url: '/api/__broken',
  permission: null,
  controller: {
    handle: async () => {
      throw new Error('conexão com senha=segredo recusada');
    },
  },
};

describe('app HTTP (comportamento transversal)', () => {
  let testApp: TestApp | undefined;

  afterEach(async () => {
    await testApp?.close();
    testApp = undefined;
  });

  it('GET /api/health responde sem autenticação', async () => {
    testApp = await buildTestApp();

    const response = await testApp.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'up' });
  });

  it('404 ROUTE_NOT_FOUND no formato padrão para rotas inexistentes', async () => {
    testApp = await buildTestApp();

    const response = await testApp.app.inject({ method: 'GET', url: '/api/nada' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('500 INTERNAL_ERROR sem vazar a mensagem original', async () => {
    testApp = await buildTestApp({ extraRoutes: () => [brokenRoute] });

    const response = await testApp.app.inject({ method: 'GET', url: '/api/__broken' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    });
    expect(response.body).not.toContain('segredo');
  });

  it('429 RATE_LIMIT_EXCEEDED ao passar do limite por IP', async () => {
    testApp = await buildTestApp({ rateLimit: { max: 3, timeWindowMs: 60_000 } });
    const app = testApp.app;
    const call = () =>
      app.inject({ method: 'GET', url: '/api/products', headers: bearer(ADMIN_TOKEN) });

    const statuses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) statuses.push((await call()).statusCode);
    const limited = await call();

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(limited.json().error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
    expect(limited.headers['retry-after']).toBeDefined();
  });
});
