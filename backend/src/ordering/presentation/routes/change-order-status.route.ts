import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Altera o status seguindo a máquina de estados (admin). */
export function changeOrderStatusRoute(controller: Controller): Route {
  return { method: 'PATCH', url: '/api/orders/:id/status', permission: 'orders:write', controller };
}
