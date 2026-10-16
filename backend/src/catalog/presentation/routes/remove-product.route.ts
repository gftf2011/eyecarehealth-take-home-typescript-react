import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Remove (soft delete) um produto (admin). */
export function removeProductRoute(controller: Controller): Route {
  return { method: 'DELETE', url: '/api/products/:id', permission: 'products:write', controller };
}
