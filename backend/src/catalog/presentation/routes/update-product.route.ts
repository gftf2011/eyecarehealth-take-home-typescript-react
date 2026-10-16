import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Atualiza um produto (admin). */
export function updateProductRoute(controller: Controller): Route {
  return { method: 'PUT', url: '/api/products/:id', permission: 'products:write', controller };
}
