import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { deliveryPersonIdBodySchema, orderSchema } from '../schemas/order.schemas';

/** Atribui (ou troca) o entregador de um pedido `ready`, sem despachar. */
export function assignDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'PATCH',
    url: '/api/orders/:id/assign',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Atribuir entregador',
      description: 'Só para pedidos `ready`; o pedido continua `ready` até o despacho.',
      tags: ['Pedidos'],
      params: idParams,
      body: deliveryPersonIdBodySchema,
      responses: {
        200: { description: 'Pedido com o entregador atribuído', schema: orderSchema },
        404: { description: 'Pedido (`ORDER_NOT_FOUND`) ou entregador (`DELIVERY_PERSON_NOT_FOUND`) não encontrado', schema: errorResponseSchema },
        422: {
          description: 'Pedido não está `ready` (`ASSIGNMENT_NOT_ALLOWED`) ou entregador inativo ou em entrega (`DELIVERY_PERSON_UNAVAILABLE`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
