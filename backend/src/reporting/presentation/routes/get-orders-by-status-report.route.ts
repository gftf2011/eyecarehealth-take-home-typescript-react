import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Pedidos por status (admin e viewer). */
export function getOrdersByStatusReportRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/reports/orders-by-status', permission: 'reports:read', controller };
}
