import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { Route } from '../http/route';
import { buildOpenApiDocument, toOpenApiPath } from './build-openapi-document';

const controller = { handle: async () => ({ status: 204 }) };
const INFO = { title: 'Teste', version: '1.0.0', description: 'Documento de teste' };

function route(overrides: Partial<Route>): Route {
  return {
    method: 'GET',
    url: '/api/things',
    permission: 'products:read',
    controller,
    docs: { summary: 'Listar coisas', tags: ['Coisas'], responses: { 200: { description: 'ok', schema: z.object({ ok: z.boolean() }) } } },
    ...overrides,
  };
}

type Operation = {
  security: unknown[];
  parameters: { name: string; in: string; required: boolean; description?: string; schema: Record<string, unknown> }[];
  requestBody?: { content: { 'application/json': { schema: Record<string, unknown> } } };
  responses: Record<string, { description: string; content?: unknown }>;
  'x-permission'?: string;
};

function operation(routes: Route[], path: string, method: string): Operation {
  const paths = buildOpenApiDocument(routes, INFO, []).paths as Record<string, Record<string, Operation>>;
  const found = paths[path]?.[method];
  if (found === undefined) throw new Error(`${method} ${path} não documentado`);
  return found;
}

describe('buildOpenApiDocument', () => {
  it('converte `:id` do Fastify para `{id}` do OpenAPI', () => {
    expect(toOpenApiPath('/api/orders/:id/status')).toBe('/api/orders/{id}/status');
  });

  it('rota protegida exige o Bearer e documenta 401 e 403; rota pública não', () => {
    const routes = [route({}), route({ url: '/api/public', permission: null })];

    const protectedOp = operation(routes, '/api/things', 'get');
    const publicOp = operation(routes, '/api/public', 'get');

    expect(protectedOp.security).toEqual([{ bearerAuth: [] }]);
    expect(protectedOp['x-permission']).toBe('products:read');
    expect(Object.keys(protectedOp.responses)).toEqual(expect.arrayContaining(['401', '403', '429', '500']));
    expect(publicOp.security).toEqual([]);
    expect(Object.keys(publicOp.responses)).not.toContain('401');
  });

  it('parâmetros de caminho, query e cookie saem dos schemas, com obrigatoriedade e descrição', () => {
    const routes = [
      route({
        url: '/api/things/:id',
        docs: {
          summary: 'Detalhar',
          tags: ['Coisas'],
          params: z.object({ id: z.string() }),
          query: z.object({ page: z.coerce.number().int().optional().meta({ description: 'Página' }), q: z.string() }),
          cookies: z.object({ session: z.string() }),
          responses: { 200: { description: 'ok' } },
        },
      }),
    ];

    const { parameters } = operation(routes, '/api/things/{id}', 'get');

    expect(parameters.map(({ name, in: location, required }) => ({ name, location, required }))).toEqual([
      { name: 'id', location: 'path', required: true },
      { name: 'page', location: 'query', required: false },
      { name: 'q', location: 'query', required: true },
      { name: 'session', location: 'cookie', required: true },
    ]);
    expect(parameters[1]?.description).toBe('Página');
    // Os limites do maior inteiro seguro que o Zod acrescenta não poluem o documento.
    expect(parameters[1]?.schema).toEqual({ type: 'integer' });
  });

  it('corpo validado vira requestBody; com validação, documenta o 400 comum', () => {
    const routes = [route({ method: 'POST', docs: { summary: 'Criar', tags: ['Coisas'], body: z.object({ name: z.string() }), responses: { 201: { description: 'criado' } } } })];

    const created = operation(routes, '/api/things', 'post');

    expect(created.requestBody?.content['application/json'].schema).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    expect(created.responses['400']?.description).toMatch(/VALIDATION_ERROR/);
  });

  it('resposta sem schema não tem corpo; erro específico da rota prevalece sobre o comum', () => {
    const routes = [
      route({
        method: 'DELETE',
        url: '/api/things/:id',
        docs: {
          summary: 'Remover',
          tags: ['Coisas'],
          params: z.object({ id: z.string() }),
          responses: { 204: { description: 'Removido' }, 400: { description: 'Específico da rota' } },
        },
      }),
    ];

    const removed = operation(routes, '/api/things/{id}', 'delete');

    expect(removed.responses['204']).toEqual({ description: 'Removido' });
    expect(removed.responses['400']?.description).toBe('Específico da rota');
  });

  it('datas e UUIDs aparecem pelo `format`, sem a regex equivalente', () => {
    const routes = [route({ docs: { summary: 'X', tags: ['Coisas'], responses: { 200: { description: 'ok', schema: z.object({ at: z.iso.datetime(), id: z.uuid() }) } } } })];

    const ok = operation(routes, '/api/things', 'get').responses['200'] as unknown as {
      content: { 'application/json': { schema: { properties: Record<string, Record<string, unknown>> } } };
    };

    const { at, id } = ok.content['application/json'].schema.properties;
    expect(at).toEqual({ type: 'string', format: 'date-time' });
    expect(id).toEqual({ type: 'string', format: 'uuid' });
  });

  it('métodos diferentes no mesmo caminho ficam no mesmo item, e caminhos extras entram como vieram', () => {
    const document = buildOpenApiDocument(
      [route({}), route({ method: 'POST', docs: { summary: 'Criar', tags: ['Coisas'], responses: { 201: { description: 'criado' } } } })],
      INFO,
      [],
      { '/api/health': { get: { summary: 'Health' } } },
    );

    expect(Object.keys(document.paths['/api/things'] ?? {})).toEqual(['get', 'post']);
    expect(document.paths['/api/health']).toEqual({ get: { summary: 'Health' } });
  });
});
