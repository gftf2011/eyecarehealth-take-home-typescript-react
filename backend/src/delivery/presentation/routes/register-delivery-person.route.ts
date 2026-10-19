import type { Controller, Route } from '../../../shared-kernel/presentation';
import { deliveryPersonSchema, registerDeliveryPersonBodySchema } from '../schemas/delivery.schemas';

/** Cadastra um entregador. */
export function registerDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/delivery-persons',
    permission: 'delivery-persons:write',
    controller,
    docs: {
      summary: 'Cadastrar entregador',
      tags: ['Entregadores'],
      body: registerDeliveryPersonBodySchema,
      responses: { 201: { description: 'Entregador cadastrado', schema: deliveryPersonSchema } },
    },
  };
}
