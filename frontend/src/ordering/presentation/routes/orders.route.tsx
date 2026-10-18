import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';
import { OrdersPage } from '../pages/orders-page/orders-page';

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
