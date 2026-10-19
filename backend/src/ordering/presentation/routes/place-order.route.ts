import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema, placeOrderBodySchema } from '../schemas/order.schemas';

/** Cria um pedido `pending` com o preço atual de cada produto. */
export function placeOrderRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Criar pedido',
      description: 'O pedido nasce `pending`. O total é calculado pelo backend a partir do preço de cada produto no momento do pedido.',
      tags: ['Pedidos'],
      body: placeOrderBodySchema,
      responses: {
        201: { description: 'Pedido criado', schema: orderSchema },
        422: { description: 'Produto inexistente ou indisponível (`UNAVAILABLE_PRODUCT`)', schema: errorResponseSchema },
      },
    },
  };
}
