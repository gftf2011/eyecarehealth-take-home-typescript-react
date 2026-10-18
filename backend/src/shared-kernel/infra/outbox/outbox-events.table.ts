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
  /** Falhas permanentes de publicação (queda do broker não conta). */
  attempts: Generated<number>;
  /** Preenchida ao desistir da mensagem (fila morta); `null` = segue na fila. */
  dead_lettered_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** Última falha de publicação, para investigar a mensagem morta. */
  last_error: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: Generated<Date>;
}

export type OutboxDatabase = {
  outbox_events: OutboxEventsTable;
};
