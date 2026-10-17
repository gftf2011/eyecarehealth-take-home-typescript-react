import type { Controller, Route } from '../../../shared-kernel/presentation';

/** Tempo médio de entrega (admin e viewer). */
export function getDeliveryTimeReportRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/reports/average-delivery-time',
    permission: 'reports:read',
    controller,
  };
}
