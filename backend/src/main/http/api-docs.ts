import swagger, { type StaticDocumentSpec } from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

import { buildOpenApiDocument, type OpenApiDocument, type Route } from '../../shared-kernel/presentation';

/** Swagger UI em `/api/docs`; o documento em `/api/docs/json` (e `/api/docs/yaml`). */
export const API_DOCS_PATH = '/api/docs';

const INFO = {
  title: 'FastMeals API',
  version: '1.0.0',
  description: [
    'API do painel administrativo da FastMeals: cardápio, pedidos, entregadores, atribuição otimizada e relatórios.',
    '',
    '**Autenticação:** `POST /api/auth/login` devolve um access token (15 min); use-o em **Authorize** (`Bearer`). O refresh token vai só no cookie `httpOnly`.',
    '',
    '**Erros:** sempre `{ error: { code, message, details? } }`, com status semântico.',
    '',
    'Gerado dos mesmos schemas Zod que validam cada requisição; os testes conferem as respostas reais contra os schemas documentados.',
  ].join('\n'),
};

const TAGS = [
  { name: 'Autenticação', description: 'Login, renovação da sessão e logout' },
  { name: 'Produtos', description: 'Cardápio (Catalog)' },
  { name: 'Pedidos', description: 'Pedidos e a máquina de estados (Ordering)' },
  { name: 'Atribuição', description: 'Sugestão otimizada pedido → entregador (algoritmo Húngaro)' },
  { name: 'Entregadores', description: 'Cadastro e disponibilidade (Delivery)' },
  { name: 'Relatórios', description: 'Métricas agregadas (Reporting)' },
  { name: 'Saúde', description: 'Health check para o orquestrador' },
];

const HEALTH_PATH = {
  get: {
    summary: 'Health check',
    description: 'Estado do PostgreSQL e do Redis. Pública.',
    tags: ['Saúde'],
    security: [],
    responses: {
      200: { description: 'Tudo de pé', content: { 'application/json': { example: { status: 'ok', checks: { database: 'up', redis: 'up' } } } } },
      503: { description: 'Alguma dependência fora', content: { 'application/json': { example: { status: 'degraded', checks: { database: 'up', redis: 'down' } } } } },
    },
  },
};

/** Documento OpenAPI das rotas do app (exportado para os testes). */
export function apiDocument(routes: readonly Route[]): OpenApiDocument {
  return buildOpenApiDocument(routes, INFO, TAGS, { '/api/health': HEALTH_PATH });
}

/**
 * Publica o documento e o Swagger UI. Registrado antes do rate limit: os
 * arquivos estáticos da interface não consomem a cota de requisições.
 */
export async function registerApiDocs(app: FastifyInstance, routes: readonly Route[]): Promise<void> {
  await app.register(swagger, {
    mode: 'static',
    // O tipo do plugin só conhece OpenAPI 2/3.0; o documento é 3.1 (JSON Schema 2020-12).
    specification: { document: apiDocument(routes) as unknown as StaticDocumentSpec['document'] },
  });
  await app.register(swaggerUi, {
    routePrefix: API_DOCS_PATH,
    uiConfig: { docExpansion: 'list', deepLinking: true, defaultModelsExpandDepth: -1, tryItOutEnabled: true },
  });
}
