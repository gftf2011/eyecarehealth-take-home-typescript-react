import type { RouteObject } from 'react-router';

import { RequirePermission } from '../../../shared-kernel/presentation';
import { ProductsPage } from '../pages/products-page/products-page';

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
