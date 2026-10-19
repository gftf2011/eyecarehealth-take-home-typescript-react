import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema } from '../schemas/order.schemas';

/** Detalhe de um pedido, com itens e entregador. */
export function getOrderRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/orders/:id',
    permission: 'orders:read',
    controller,
    docs: {
      summary: 'Detalhar pedido',
      tags: ['Pedidos'],
      params: idParams,
      responses: {
        200: { description: 'O pedido, com itens e entregador', schema: orderSchema },
        404: { description: 'Pedido não encontrado (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
      },
    },
  };
}
