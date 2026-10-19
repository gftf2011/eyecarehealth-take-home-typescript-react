import type { Permission } from '../../domain';
import type { RouteDocs } from '../openapi/route-docs';
import type { Controller } from './http';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Definição declarativa de uma rota: método, caminho, permissão exigida e o
 * controller. Não depende de framework — o adapter do Fastify a registra.
 */
export type Route = {
  readonly method: HttpMethod;
  /** Caminho no formato do Fastify, ex.: `/api/products/:id`. */
  readonly url: string;
  /** `null` apenas para rotas públicas (ex.: login, health check). */
  readonly permission: Permission | null;
  readonly controller: Controller;
  /** Documentação OpenAPI da rota (obrigatória: toda rota aparece no Swagger). */
  readonly docs: RouteDocs;
};
