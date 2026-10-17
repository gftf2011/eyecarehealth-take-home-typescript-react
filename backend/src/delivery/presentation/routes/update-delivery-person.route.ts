import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Atualiza dados, ativação e localização de um entregador (admin). */
export function updateDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'PUT',
    url: '/api/delivery-persons/:id',
    permission: 'delivery-persons:write',
    controller,
  };
}
