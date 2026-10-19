import type { Controller, Route } from '../../../shared-kernel/presentation';
import { listOrdersQuerySchema, orderPageSchema } from '../schemas/order.schemas';

/** Painel de pedidos: filtros, ordenação e paginação. */
export function listOrdersRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/orders',
    permission: 'orders:read',
    controller,
    docs: {
      summary: 'Listar pedidos',
      description: 'Filtros por status e por dia de criação (dias locais de São Paulo, pontas inclusivas), ordenação e paginação.',
      tags: ['Pedidos'],
      query: listOrdersQuerySchema,
      responses: { 200: { description: 'Página de pedidos', schema: orderPageSchema } },
    },
  };
}
