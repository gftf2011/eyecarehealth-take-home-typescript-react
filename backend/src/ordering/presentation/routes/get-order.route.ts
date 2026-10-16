import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Detalhe de um pedido (admin e viewer). */
export function getOrderRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/orders/:id', permission: 'orders:read', controller };
}
