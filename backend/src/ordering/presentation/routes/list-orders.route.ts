import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Lista pedidos com paginação, filtros e ordenação (admin e viewer). */
export function listOrdersRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/orders', permission: 'orders:read', controller };
}
