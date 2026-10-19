import type { Migration } from 'kysely/migration';

import * as createDeliveryPersons from './2026-10-16T10-00-00_create-delivery-persons';
import * as linkDeliveryPersonToUser from './2026-10-19T13-00-01_link-delivery-person-to-user';

/** Migrations do contexto Delivery. */
export const deliveryMigrations: Record<string, Migration> = {
  '2026-10-16T10-00-00_create-delivery-persons': createDeliveryPersons,
  '2026-10-19T13-00-01_link-delivery-person-to-user': linkDeliveryPersonToUser,
};
