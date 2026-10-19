import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';

/** Remove um entregador (soft delete). */
export function removeDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'DELETE',
    url: '/api/delivery-persons/:id',
    permission: 'delivery-persons:write',
    controller,
    docs: {
      summary: 'Remover entregador',
      description: 'Soft delete: pedidos antigos continuam mostrando o entregador.',
      tags: ['Entregadores'],
      params: idParams,
      responses: {
        204: { description: 'Removido' },
        404: { description: 'Entregador não encontrado (`DELIVERY_PERSON_NOT_FOUND`)', schema: errorResponseSchema },
        409: { description: 'Entregador com entrega em andamento (`DELIVERY_PERSON_IN_USE`)', schema: errorResponseSchema },
      },
    },
  };
}
