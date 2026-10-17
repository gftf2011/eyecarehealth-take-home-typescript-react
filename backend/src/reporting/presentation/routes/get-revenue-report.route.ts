import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Receita por período (admin e viewer). */
export function getRevenueReportRoute(controller: Controller): Route {
  return { method: 'GET', url: '/api/reports/revenue', permission: 'reports:read', controller };
}
