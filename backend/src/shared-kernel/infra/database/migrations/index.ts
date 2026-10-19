import type { Migration } from 'kysely/migration';

import * as createSetUpdatedAtFunction from './2026-10-15T10-00-00_create-set-updated-at-function';
import * as createOutboxEvents from './2026-10-15T10-00-01_create-outbox-events';
import * as addOutboxDeadLetter from './2026-10-18T10-00-00_add-outbox-dead-letter';
import * as addOutboxSequence from './2026-10-18T11-00-00_add-outbox-sequence';
import * as addOutboxTraceContext from './2026-10-19T10-00-00_add-outbox-trace-context';

/** Migrations da infraestrutura comum (trigger de updated_at, outbox e fila morta). */
export const sharedKernelMigrations: Record<string, Migration> = {
  '2026-10-15T10-00-00_create-set-updated-at-function': createSetUpdatedAtFunction,
  '2026-10-15T10-00-01_create-outbox-events': createOutboxEvents,
  '2026-10-18T10-00-00_add-outbox-dead-letter': addOutboxDeadLetter,
  '2026-10-18T11-00-00_add-outbox-sequence': addOutboxSequence,
  '2026-10-19T10-00-00_add-outbox-trace-context': addOutboxTraceContext,
};
