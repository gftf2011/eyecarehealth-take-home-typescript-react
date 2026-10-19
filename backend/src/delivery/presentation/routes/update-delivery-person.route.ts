import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { deliveryPersonSchema, updateDeliveryPersonBodySchema } from '../schemas/delivery.schemas';

/** Atualiza dados, ativação ou localização de um entregador. */
export function updateDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'PUT',
    url: '/api/delivery-persons/:id',
    permission: 'delivery-persons:write',
    controller,
    docs: {
      summary: 'Atualizar entregador',
      description: 'Atualização parcial. Latitude e longitude vão juntas; as duas `null` apagam a localização.',
      tags: ['Entregadores'],
      params: idParams,
      body: updateDeliveryPersonBodySchema,
      responses: {
        200: { description: 'Entregador atualizado', schema: deliveryPersonSchema },
        404: { description: 'Entregador não encontrado (`DELIVERY_PERSON_NOT_FOUND`)', schema: errorResponseSchema },
        422: { description: 'Entregador removido (`DELIVERY_PERSON_REMOVED`)', schema: errorResponseSchema },
      },
    },
  };
}
