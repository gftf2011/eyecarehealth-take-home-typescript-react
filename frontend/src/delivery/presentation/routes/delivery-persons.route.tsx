import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: cada tela vira um chunk próprio no build.
const DeliveryPersonsPage = lazy(() =>
  import('../pages/delivery-persons-page/delivery-persons-page').then((module) => ({ default: module.DeliveryPersonsPage })),
);

export const DELIVERY_PERSONS_PATH = '/entregadores';

/** `/entregadores` — a frota (leitura com `delivery-persons:read`; edição com `delivery-persons:write`). */
export function deliveryPersonsRoute(): RouteObject {
  return {
    path: DELIVERY_PERSONS_PATH,
    element: (
      <RequirePermission permission="delivery-persons:read">
        <DeliveryPersonsPage />
      </RequirePermission>
    ),
  };
}
