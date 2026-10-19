import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { myDeliveriesSchema } from '../schemas/order.schemas';

/** As entregas do entregador logado. */
export function getMyDeliveriesRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/me/deliveries',
    permission: 'my-deliveries:read',
    controller,
    docs: {
      summary: 'Minhas entregas',
      description:
        'Só os pedidos do entregador logado (ele vem do usuário do token): a entrega em andamento e as próximas, com cliente, telefone, endereço e itens.',
      tags: ['Minhas entregas'],
      responses: {
        200: { description: 'Entregas do entregador', schema: myDeliveriesSchema },
        404: { description: 'O usuário não é o login de nenhum entregador (`DELIVERY_PERSON_NOT_LINKED`)', schema: errorResponseSchema },
      },
    },
  };
}
