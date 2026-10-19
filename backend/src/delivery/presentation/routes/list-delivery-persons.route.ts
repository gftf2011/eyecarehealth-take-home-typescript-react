import type { Controller, Route } from '../../../shared-kernel/presentation';
import { deliveryPersonListSchema, listDeliveryPersonsQuerySchema } from '../schemas/delivery.schemas';

/** Lista os entregadores (sem os removidos). */
export function listDeliveryPersonsRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/delivery-persons',
    permission: 'delivery-persons:read',
    controller,
    docs: {
      summary: 'Listar entregadores',
      description: 'Filtros por ativação e disponibilidade; cada item traz o pedido em entrega, se houver.',
      tags: ['Entregadores'],
      query: listDeliveryPersonsQuerySchema,
      responses: { 200: { description: 'Entregadores', schema: deliveryPersonListSchema } },
    },
  };
}
