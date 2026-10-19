import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema } from '../schemas/order.schemas';

/** Tentar a entrega de novo (decisão do gestor sobre o problema relatado pelo entregador). */
export function retryDeliveryRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/:id/delivery-issue/retry',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Tentar a entrega de novo',
      description: 'O problema relatado termina e o entregador segue com o pedido, em `delivering`.',
      tags: ['Pedidos'],
      params: idParams,
      responses: {
        200: { description: 'Pedido em `delivering`, com o problema resolvido (`retried`)', schema: orderSchema },
        404: { description: 'Pedido não encontrado (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
        422: {
          description:
            'Sem problema relatado em aberto (`NO_OPEN_DELIVERY_ISSUE`), ou o cliente recusou / já houve 2 novas tentativas (`DECISION_NOT_ALLOWED`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
