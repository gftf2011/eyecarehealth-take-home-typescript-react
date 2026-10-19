import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { changeOrderStatusBodySchema, orderSchema } from '../schemas/order.schemas';

/** Avança o pedido pela máquina de estados. */
export function changeOrderStatusRoute(controller: Controller): Route {
  return {
    method: 'PATCH',
    url: '/api/orders/:id/status',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Mudar status do pedido',
      description: 'Segue a máquina de estados. A ida para `delivering` é o despacho: confere, na mesma transação, que o entregador atribuído continua ativo e livre.',
      tags: ['Pedidos'],
      params: idParams,
      body: changeOrderStatusBodySchema,
      responses: {
        200: { description: 'Pedido com o novo status', schema: orderSchema },
        404: { description: 'Pedido não encontrado (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
        422: {
          description: 'Transição inválida (`INVALID_STATUS_TRANSITION`) ou entregador indisponível no despacho (`DELIVERY_PERSON_UNAVAILABLE`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
