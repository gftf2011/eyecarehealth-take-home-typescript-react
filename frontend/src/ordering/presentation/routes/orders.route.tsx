import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: cada tela vira um chunk próprio no build.
const OrdersPage = lazy(() => import('../pages/orders-page/orders-page').then((module) => ({ default: module.OrdersPage })));

export const ORDERS_PATH = '/pedidos';

/** `/pedidos` — painel de pedidos (admin e viewer; ações só para `orders:write`). */
export function ordersRoute(): RouteObject {
  return {
    path: ORDERS_PATH,
    element: (
      <RequirePermission permission="orders:read">
        <OrdersPage />
      </RequirePermission>
    ),
  };
}
