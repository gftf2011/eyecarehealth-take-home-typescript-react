import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';

// Carregada sob demanda: cada tela vira um chunk próprio no build.
const ProductsPage = lazy(() => import('../pages/products-page/products-page').then((module) => ({ default: module.ProductsPage })));

export const PRODUCTS_PATH = '/produtos';

/** `/produtos` — cardápio (admin e viewer; edição só para `products:write`). */
export function productsRoute(): RouteObject {
  return {
    path: PRODUCTS_PATH,
    element: (
      <RequirePermission permission="products:read">
        <ProductsPage />
      </RequirePermission>
    ),
  };
}
