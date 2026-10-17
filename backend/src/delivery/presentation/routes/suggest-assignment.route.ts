import type { Controller, Route } from '../../../shared-kernel/presentation';

/**
 * Sugere a atribuição otimizada dos pedidos `ready` (admin). A URL fica sob
 * `/api/orders` (spec), mas a lógica é do Delivery: otimizador e entregadores.
 * Exige `orders:write` porque o resultado é usado para atribuir pedidos.
 */
export function suggestAssignmentRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/optimize-assignment',
    permission: 'orders:write',
    controller,
  };
}
