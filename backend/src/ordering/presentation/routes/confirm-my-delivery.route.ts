import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema } from '../schemas/order.schemas';

/** O entregador logado confirma a própria entrega. */
export function confirmMyDeliveryRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/me/deliveries/:id/delivered',
    permission: 'my-deliveries:write',
    controller,
    docs: {
      summary: 'Confirmar minha entrega',
      description:
        '`delivering → delivered`, só para o pedido do próprio entregador. Pedido de outro entregador responde `404`, como se não existisse.',
      tags: ['Minhas entregas'],
      params: idParams,
      responses: {
        200: { description: 'Pedido entregue', schema: orderSchema },
        404: {
          description: 'Pedido inexistente ou de outro entregador (`ORDER_NOT_FOUND`), ou usuário sem entregador (`DELIVERY_PERSON_NOT_LINKED`)',
          schema: errorResponseSchema,
        },
        422: { description: 'O pedido não está em entrega (`INVALID_STATUS_TRANSITION`)', schema: errorResponseSchema },
      },
    },
  };
}
