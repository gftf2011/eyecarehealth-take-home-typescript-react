import type { Migration } from 'kysely/migration';

import * as createOrders from './2026-10-16T10-01-00_create-orders';

/** Migrations do contexto Ordering. */
export const orderingMigrations: Record<string, Migration> = {
  '2026-10-16T10-01-00_create-orders': createOrders,
};
