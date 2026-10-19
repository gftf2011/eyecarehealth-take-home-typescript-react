import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: cada tela vira um chunk próprio no build.
const MyDeliveriesPage = lazy(() =>
  import('../pages/my-deliveries-page/my-deliveries-page').then((module) => ({ default: module.MyDeliveriesPage })),
);

export const MY_DELIVERIES_PATH = '/minhas-entregas';

/** `/minhas-entregas` — a tela do entregador (perfil `courier`). */
export function myDeliveriesRoute(): RouteObject {
  return {
    path: MY_DELIVERIES_PATH,
    element: (
      <RequirePermission permission="my-deliveries:read">
        <MyDeliveriesPage />
      </RequirePermission>
    ),
  };
}
