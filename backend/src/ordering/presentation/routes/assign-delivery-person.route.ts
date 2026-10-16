import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Atribui ou troca o entregador de um pedido ainda não despachado (admin). */
export function assignDeliveryPersonRoute(controller: Controller): Route {
  return { method: 'PATCH', url: '/api/orders/:id/assign', permission: 'orders:write', controller };
}
