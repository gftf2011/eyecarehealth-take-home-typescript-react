import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Cadastra um produto (admin). */
export function createProductRoute(controller: Controller): Route {
  return { method: 'POST', url: '/api/products', permission: 'products:write', controller };
}
