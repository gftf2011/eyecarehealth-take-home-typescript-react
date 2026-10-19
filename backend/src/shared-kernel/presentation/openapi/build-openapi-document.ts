import { z } from 'zod';

import type { Route } from '../http/route';
import { errorResponseSchema } from './common.schemas';
import type { ResponseDoc } from './route-docs';

export type OpenApiInfo = { readonly title: string; readonly version: string; readonly description: string };

type JsonObject = Record<string, unknown>;

/** Documento OpenAPI 3.1 (JSON Schema 2020-12 nos schemas). */
export type OpenApiDocument = JsonObject & { readonly openapi: string; readonly paths: Record<string, JsonObject> };

const COMMON_ERRORS: Readonly<Record<number, string>> = {
  400: 'Requisição inválida (`VALIDATION_ERROR`, com os campos em `details`)',
  401: 'Sem token ou token inválido (`INVALID_TOKEN`), ou expirado (`TOKEN_EXPIRED`)',
  403: 'O perfil não tem a permissão exigida (`FORBIDDEN`)',
  429: 'Limite de requisições atingido (`RATE_LIMIT_EXCEEDED`, com `Retry-After`)',
  500: 'Erro inesperado (`INTERNAL_ERROR`)',
};

/** Limites que o Zod põe em todo inteiro (o maior inteiro seguro): só poluem a documentação. */
const SAFE_INTEGER_LIMIT = Number.MAX_SAFE_INTEGER;

/** Schema Zod → JSON Schema; `input` para o que o cliente envia, `output` para o que recebe. */
function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonObject {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io,
    unrepresentable: 'any',
    override: ({ jsonSchema: generated }) => {
      // `format` já descreve data e UUID; a regex equivalente só atrapalha a leitura.
      if (generated.format === 'date-time' || generated.format === 'uuid') delete generated.pattern;
      if (generated.minimum === -SAFE_INTEGER_LIMIT) delete generated.minimum;
      if (generated.maximum === SAFE_INTEGER_LIMIT) delete generated.maximum;
    },
  });
  return rest;
}

function isOptional(schema: z.ZodType): boolean {
  return schema.safeParse(undefined).success;
}

function parametersOf(route: Route): JsonObject[] {
  const { params, query, cookies } = route.docs;
  const fromObject = (object: z.ZodObject | undefined, location: 'path' | 'query' | 'cookie'): JsonObject[] =>
    Object.entries(object?.shape ?? {}).map(([name, field]) => {
      const schema = jsonSchema(field as z.ZodType, 'input');
      const { description, ...rest } = schema;
      return {
        name,
        in: location,
        required: location === 'path' || !isOptional(field as z.ZodType),
        ...(typeof description === 'string' && { description }),
        schema: rest,
      };
    });
  return [...fromObject(params, 'path'), ...fromObject(query, 'query'), ...fromObject(cookies, 'cookie')];
}

function response({ description, schema }: ResponseDoc): JsonObject {
  return schema === undefined
    ? { description }
    : { description, content: { 'application/json': { schema: jsonSchema(schema, 'output') } } };
}

function operationOf(route: Route): JsonObject {
  const { docs } = route;
  const validates = docs.params !== undefined || docs.query !== undefined || docs.body !== undefined;
  const errors = Object.entries(COMMON_ERRORS).filter(([status]) => {
    if (status === '400') return validates;
    if (status === '401' || status === '403') return route.permission !== null;
    return true;
  });
  const responses: JsonObject = Object.fromEntries(
    Object.entries(docs.responses).map(([status, doc]) => [status, response(doc)]),
  );
  for (const [status, description] of errors) {
    if (!(status in responses)) responses[status] = response({ description, schema: errorResponseSchema });
  }
  const permission = route.permission === null ? 'Pública.' : `Permissão: \`${route.permission}\`.`;

  return {
    summary: docs.summary,
    description: [docs.description, permission].filter(Boolean).join('\n\n'),
    tags: [...docs.tags],
    ...(route.permission === null ? { security: [] } : { security: [{ bearerAuth: [] }] }),
    ...(route.permission !== null && { 'x-permission': route.permission }),
    parameters: parametersOf(route),
    ...(docs.body !== undefined && {
      requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(docs.body, 'input') } } },
    }),
    responses,
  };
}

/** Caminho do Fastify (`/api/orders/:id`) no formato OpenAPI (`/api/orders/{id}`). */
export function toOpenApiPath(url: string): string {
  return url.replace(/:(\w+)/g, '{$1}');
}

/**
 * Gera o documento OpenAPI 3.1 a partir das rotas registradas. Cada rota
 * traz a própria documentação (`Route.docs`), feita dos schemas que a
 * validam; o gerador só monta o documento e acrescenta os erros comuns.
 */
/**
 * `extraPaths`: rotas que não passam por `Route` (ex.: o health check, ligado
 * direto no app), documentadas à mão.
 */
export function buildOpenApiDocument(
  routes: readonly Route[],
  info: OpenApiInfo,
  tags: readonly JsonObject[],
  extraPaths: Readonly<Record<string, JsonObject>> = {},
): OpenApiDocument {
  const paths: Record<string, JsonObject> = { ...extraPaths };
  for (const route of routes) {
    const path = toOpenApiPath(route.url);
    paths[path] = { ...paths[path], [route.method.toLowerCase()]: operationOf(route) };
  }
  return {
    openapi: '3.1.0',
    info,
    tags: [...tags],
    servers: [{ url: '/', description: 'Mesma origem (via nginx do painel ou direto na API)' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token de `POST /api/auth/login` (15 min). O refresh token vai só no cookie httpOnly.',
        },
      },
    },
    paths,
  };
}
