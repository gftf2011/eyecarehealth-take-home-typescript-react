import type { Controller, Route } from '../../../shared-kernel/presentation';
import { deliveryTimeReportSchema, periodQuerySchema } from '../schemas/report.schemas';

/** Tempo médio de entrega (admin e viewer). */
export function getDeliveryTimeReportRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/reports/average-delivery-time',
    permission: 'reports:read',
    controller,
    docs: {
      summary: 'Tempo médio de entrega',
      description: 'Da criação do pedido até a transição para `delivered`, geral e por tipo de veículo. Dias locais de São Paulo, pontas inclusivas.',
      tags: ['Relatórios'],
      query: periodQuerySchema,
      responses: {
        200: { description: 'Tempo médio de entrega', schema: deliveryTimeReportSchema },
      },
    },
  };
}
