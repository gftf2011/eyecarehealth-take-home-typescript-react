import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Lista produtos com paginação, busca e filtros (admin e viewer). */
export function listProductsRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/products', permission: 'products:read', controller };
}
