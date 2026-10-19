import SwaggerParser from '@apidevtools/swagger-parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toOpenApiPath } from '../../shared-kernel/presentation';
import { API_DOCS_PATH } from './api-docs';
import { buildTestApp, type TestApp } from './testing/build-test-app';

describe('Documentação OpenAPI (Swagger)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function openApiDocument(): Promise<{ openapi: string; paths: Record<string, Record<string, unknown>> }> {
    const response = await testApp.app.inject({ method: 'GET', url: `${API_DOCS_PATH}/json` });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  it('é um documento OpenAPI 3.1 válido pela especificação', async () => {
    const document = await openApiDocument();

    expect(document.openapi).toBe('3.1.0');
    await expect(SwaggerParser.validate(structuredClone(document) as never)).resolves.toBeDefined();
  });

  it('documenta todas as rotas registradas, e só elas (além do health check)', async () => {
    const document = await openApiDocument();

    const documented = Object.entries(document.paths)
      .flatMap(([path, operations]) => Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    const registered = [
      ...testApp.routes.map((route) => `${route.method} ${toOpenApiPath(route.url)}`),
      'GET /api/health',
    ].sort();

    expect(documented).toEqual(registered);
  });

  it('serve o Swagger UI, sem autenticação', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: `${API_DOCS_PATH}/` });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('swagger');
  });

  it('pode ser desligada (`API_DOCS_ENABLED=false`)', async () => {
    const withoutDocs = await buildTestApp({ apiDocs: false });

    const response = await withoutDocs.app.inject({ method: 'GET', url: `${API_DOCS_PATH}/json` });
    await withoutDocs.close();

    expect(response.statusCode).toBe(404);
  });
});
