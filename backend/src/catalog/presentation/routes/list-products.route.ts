import type { Controller, Route } from '../../../shared-kernel/presentation';
import { listProductsQuerySchema, productPageSchema } from '../schemas/product.schemas';

/** Lista o cardápio do painel, com busca, filtros e paginação. */
export function listProductsRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/products',
    permission: 'products:read',
    controller,
    docs: {
      summary: 'Listar produtos',
      description: 'Busca parcial por nome, filtros por categoria e disponibilidade, ordenação e paginação. Inclui os indisponíveis (o painel precisa vê-los).',
      tags: ['Produtos'],
      query: listProductsQuerySchema,
      responses: { 200: { description: 'Página de produtos', schema: productPageSchema } },
    },
  };
}
