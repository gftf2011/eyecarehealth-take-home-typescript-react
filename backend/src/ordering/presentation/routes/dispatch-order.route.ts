import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Atribui o entregador e despacha o pedido `ready` numa só transação (admin). */
export function dispatchOrderRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/orders/:id/dispatch', permission: 'orders:write', controller };
}
