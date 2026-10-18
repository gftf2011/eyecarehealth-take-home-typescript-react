import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: cada tela vira um chunk próprio no build.
const AssignmentPage = lazy(() => import('../pages/assignment-page/assignment-page').then((module) => ({ default: module.AssignmentPage })));

export const ASSIGNMENT_PATH = '/atribuicao';

/** `/atribuicao` — sugerir e aceitar atribuições (despachar exige `orders:write`). */
export function assignmentRoute(): RouteObject {
  return {
    path: ASSIGNMENT_PATH,
    element: (
      <RequirePermission permission="orders:write">
        <AssignmentPage />
      </RequirePermission>
    ),
  };
}
