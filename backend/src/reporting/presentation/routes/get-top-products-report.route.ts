import type { Controller, Route } from '../../../shared-kernel/presentation';
import { topProductsQuerySchema, topProductsReportSchema } from '../schemas/report.schemas';

/** Produtos mais vendidos (admin e viewer). */
export function getTopProductsReportRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/reports/top-products',
    permission: 'reports:read',
    controller,
    docs: {
      summary: 'Produtos mais vendidos',
      description: 'Ranking por quantidade vendida em pedidos **entregues** no período, com o nome atual do produto. Dias locais de São Paulo, pontas inclusivas.',
      tags: ['Relatórios'],
      query: topProductsQuerySchema,
      responses: {
        200: { description: 'Produtos mais vendidos', schema: topProductsReportSchema },
      },
    },
  };
}
