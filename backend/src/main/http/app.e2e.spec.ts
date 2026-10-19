import { afterEach, describe, expect, it } from 'vitest';

import type { Route } from '../../shared-kernel/presentation';
import { buildTestApp, type TestApp } from './testing/build-test-app';

/** Rota de teste que falha com um erro inesperado (bug). */
const brokenRoute: Route = {
  method: 'GET',
  url: '/api/__broken',
  permission: null,
  docs: { summary: 'Rota de teste', tags: ['Teste'], responses: {} },
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
    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
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
});
