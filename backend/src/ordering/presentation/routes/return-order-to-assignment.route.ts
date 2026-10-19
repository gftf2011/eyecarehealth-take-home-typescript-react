import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { orderSchema, returnToAssignmentBodySchema } from '../schemas/order.schemas';

/** Devolve uma entrega em andamento para a atribuição, com motivo. */
export function returnOrderToAssignmentRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/:id/return-to-assignment',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Devolver entrega para a atribuição',
      description:
        'Para quando o entregador não pode concluir a entrega (sem contato, acidente, veículo quebrado): o pedido vai de `delivering` para `ready`, sem entregador, e o motivo fica em `statusHistory`. O entregador fica livre. É uma decisão do gestor; nada faz isso automaticamente.',
      tags: ['Pedidos'],
      params: idParams,
      body: returnToAssignmentBodySchema,
      responses: {
        200: { description: 'Pedido de volta em `ready`, sem entregador', schema: orderSchema },
        404: { description: 'Pedido não encontrado (`ORDER_NOT_FOUND`)', schema: errorResponseSchema },
        422: {
          description:
            'O pedido não está em entrega (`INVALID_STATUS_TRANSITION`), ou o problema relatado não permite (cliente recusou: `DECISION_NOT_ALLOWED`)',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
