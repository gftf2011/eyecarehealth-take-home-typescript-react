import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Remove um entregador sem entrega em andamento (admin). */
export function removeDeliveryPersonRoute(controller: Controller): Route {
  return {
    method: 'DELETE',
    url: '/api/delivery-persons/:id',
    permission: 'delivery-persons:write',
    controller,
  };
}
