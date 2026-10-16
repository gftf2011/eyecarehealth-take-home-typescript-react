import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Cria um pedido (admin). */
export function placeOrderRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/orders', permission: 'orders:write', controller };
}
