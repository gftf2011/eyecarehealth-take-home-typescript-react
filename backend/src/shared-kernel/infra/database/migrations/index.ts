import type { Migration } from 'kysely/migration';

import * as createSetUpdatedAtFunction from './2026-10-15T10-00-00_create-set-updated-at-function';
import * as createOutboxEvents from './2026-10-15T10-00-01_create-outbox-events';

/** Migrations da infraestrutura comum (trigger de updated_at, outbox). */
export const sharedKernelMigrations: Record<string, Migration> = {
  '2026-10-15T10-00-00_create-set-updated-at-function': createSetUpdatedAtFunction,
  '2026-10-15T10-00-01_create-outbox-events': createOutboxEvents,
};
