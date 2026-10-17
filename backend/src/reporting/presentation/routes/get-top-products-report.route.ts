import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Produtos mais vendidos (admin e viewer). */
export function getTopProductsReportRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/reports/top-products', permission: 'reports:read', controller };
}
