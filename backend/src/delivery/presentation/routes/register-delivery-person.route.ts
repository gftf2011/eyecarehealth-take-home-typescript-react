import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Cadastra um entregador (admin). */
export function registerDeliveryPersonRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/delivery-persons', permission: 'delivery-persons:write', controller };
}
