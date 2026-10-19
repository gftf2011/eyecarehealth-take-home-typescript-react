import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema } from '../schemas/order.schemas';

/** Cancelar a entrega que falhou (decisão do gestor sobre o problema relatado pelo entregador). */
export function cancelFailedDeliveryRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/:id/delivery-issue/cancel',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Cancelar a entrega que falhou',
      description: '`delivering → cancelled`, a única saída de `delivering` para `cancelled`, e só com um problema relatado. O motivo vai para `statusHistory`.',
      tags: ['Pedidos'],
      params: idParams,
      responses: {
        200: { description: 'Pedido `cancelled`, com o problema resolvido (`cancelled`)', schema: orderSchema },
        404: { description: 'Pedido não encontrado (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
        422: { description: 'Sem problema relatado em aberto (`NO_OPEN_DELIVERY_ISSUE`)', schema: errorResponseSchema },
      },
    },
  };
}
