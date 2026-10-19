import type { Migration } from 'kysely/migration';

import * as createOrders from './2026-10-16T10-01-00_create-orders';
import * as addStatusChangeReason from './2026-10-19T12-00-00_add-status-change-reason';
import * as createOrderDeliveryIssues from './2026-10-19T14-00-00_create-order-delivery-issues';
import * as keysetPagination from './2026-10-19T15-00-01_orders-keyset-pagination';

/** Migrations do contexto Ordering. */
export const orderingMigrations: Record<string, Migration> = {
  '2026-10-16T10-01-00_create-orders': createOrders,
  '2026-10-19T12-00-00_add-status-change-reason': addStatusChangeReason,
  '2026-10-19T14-00-00_create-order-delivery-issues': createOrderDeliveryIssues,
  '2026-10-19T15-00-01_orders-keyset-pagination': keysetPagination,
};
