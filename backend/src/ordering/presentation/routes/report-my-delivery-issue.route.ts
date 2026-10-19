import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { deliveryIssueBodySchema, orderSchema } from '../schemas/order.schemas';

/** O entregador logado relata que não conseguiu entregar. */
export function reportMyDeliveryIssueRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/me/deliveries/:id/issue',
    permission: 'my-deliveries:write',
    controller,
    docs: {
      summary: 'Relatar problema na minha entrega',
      description:
        'Cliente ausente, endereço não encontrado, recusa ou outro motivo (com observação). O pedido continua `delivering`, com o entregador, até o gestor decidir: tentar de novo, devolver para a atribuição ou cancelar.',
      tags: ['Minhas entregas'],
      params: idParams,
      body: deliveryIssueBodySchema,
      responses: {
        200: { description: 'Pedido com o problema aberto em `deliveryIssues`', schema: orderSchema },
        404: { description: 'Pedido inexistente ou de outro entregador (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
        422: {
          description: 'A entrega não está em andamento (`DELIVERY_NOT_IN_PROGRESS`) ou já tem problema aberto (`DELIVERY_ISSUE_ALREADY_OPEN`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
