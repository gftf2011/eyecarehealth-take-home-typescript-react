import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: a biblioteca de gráficos só entra no chunk desta tela.
const ReportsPage = lazy(() => import('../pages/reports-page/reports-page').then((module) => ({ default: module.ReportsPage })));

export const REPORTS_PATH = '/relatorios';

/** `/relatorios` — métricas do período (admin e viewer). */
export function reportsRoute(): RouteObject {
  return {
    path: REPORTS_PATH,
    element: (
      <RequirePermission permission="reports:read">
        <ReportsPage />
      </RequirePermission>
    ),
  };
}
