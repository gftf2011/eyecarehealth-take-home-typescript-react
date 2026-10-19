import type { Migration } from 'kysely/migration';

import * as createProducts from './2026-10-15T10-01-00_create-products';
import * as keysetPagination from './2026-10-19T15-00-00_products-keyset-pagination';

/** Migrations do contexto Catalog. */
export const catalogMigrations: Record<string, Migration> = {
  '2026-10-15T10-01-00_create-products': createProducts,
  '2026-10-19T15-00-00_products-keyset-pagination': keysetPagination,
};
