import type { Controller, Route } from '../../../shared-kernel/presentation';
import { ordersByStatusReportSchema, periodQuerySchema } from '../schemas/report.schemas';

/** Pedidos por status (admin e viewer). */
export function getOrdersByStatusReportRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/reports/orders-by-status',
    permission: 'reports:read',
    controller,
    docs: {
      summary: 'Pedidos por status',
      description: 'Contagem de pedidos por status atual, considerando os criados no período. Dias locais de São Paulo, pontas inclusivas.',
      tags: ['Relatórios'],
      query: periodQuerySchema,
      responses: {
        200: { description: 'Pedidos por status', schema: ordersByStatusReportSchema },
      },
    },
  };
}
