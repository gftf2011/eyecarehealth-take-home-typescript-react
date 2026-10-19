import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { deliveryPersonIdBodySchema, orderSchema } from '../schemas/order.schemas';

/** Atribui e despacha numa transação só (aceitar uma sugestão do otimizador). */
export function dispatchOrderRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/:id/dispatch',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Despachar pedido',
      description:
        'Numa transação: confere que o entregador está disponível, atribui e leva o pedido de `ready` para `delivering`. É o que o painel chama ao aceitar uma sugestão de atribuição.',
      tags: ['Pedidos'],
      params: idParams,
      body: deliveryPersonIdBodySchema,
      responses: {
        200: { description: 'Pedido em `delivering`', schema: orderSchema },
        404: { description: 'Pedido (`ORDER_NOT_FOUND`) ou entregador (`DELIVERY_PERSON_NOT_FOUND`) não encontrado', schema: errorResponseSchema },
        422: {
          description: 'Pedido não está `ready` (`INVALID_STATUS_TRANSITION`) ou entregador indisponível (`DELIVERY_PERSON_UNAVAILABLE`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
