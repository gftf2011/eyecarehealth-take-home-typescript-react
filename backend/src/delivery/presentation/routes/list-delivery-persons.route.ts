import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Lista os entregadores (admin). */
export function listDeliveryPersonsRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/delivery-persons', permission: 'delivery-persons:read', controller };
}
