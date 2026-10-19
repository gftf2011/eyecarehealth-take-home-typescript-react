import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { revenueQuerySchema, revenueReportSchema } from '../schemas/report.schemas';

/** Receita por período (admin e viewer). */
export function getRevenueReportRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/reports/revenue',
    permission: 'reports:read',
    controller,
    docs: {
      summary: 'Receita por período',
      description: 'Receita, número de pedidos, ticket médio e série diária dos pedidos **entregues**, pela data da entrega. Dias locais de São Paulo, pontas inclusivas.',
      tags: ['Relatórios'],
      query: revenueQuerySchema,
      responses: {
        200: { description: 'Receita por período', schema: revenueReportSchema },
        400: { description: 'Datas ausentes (`REQUIRED_FIELD`), inválidas ou período acima de 366 dias (`REPORT_PERIOD_TOO_LONG`)', schema: errorResponseSchema },
      },
    },
  };
}
