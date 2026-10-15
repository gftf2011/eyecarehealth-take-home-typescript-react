import type { ColumnType, Generated } from 'kysely';

import type { JsonObject } from '../../domain';

/** Linha da tabela `outbox_events` (transactional outbox). */
export interface OutboxEventsTable {
  /** É o `eventId` do evento de domínio: garante idempotência no despacho. */
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_name: string;
  event_version: number;
  /** `jsonb`: grava-se o JSON serializado e lê-se o objeto. */
  payload: ColumnType<JsonObject, string, string>;
  occurred_at: Date;
  published_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  attempts: Generated<number>;
  created_at: Generated<Date>;
}

export type OutboxDatabase = {
  outbox_events: OutboxEventsTable;
};
