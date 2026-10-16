import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Consulta um produto pelo ID (admin e viewer). */
export function getProductRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/products/:id', permission: 'products:read', controller };
}
