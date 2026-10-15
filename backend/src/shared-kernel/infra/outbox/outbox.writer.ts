import type { Kysely, Transaction } from 'kysely';

import type { DomainEvent } from '../../domain';
import type { OutboxDatabase } from './outbox-events.table';

/**
 * Grava eventos de domínio no outbox usando a **mesma** transação das
 * escritas do agregado: ou ambos são confirmados, ou nenhum.
 */
export async function appendToOutbox(
  trx: Transaction<OutboxDatabase> | Kysely<OutboxDatabase>,
  events: readonly DomainEvent[],
): Promise<void> {
  if (events.length === 0) return;

  await trx
    .insertInto('outbox_events')
    .values(
      events.map((event) => ({
        id: event.eventId,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_name: event.eventName,
        event_version: event.eventVersion,
        payload: JSON.stringify(event.payload),
        occurred_at: event.occurredAt,
      })),
    )
    .execute();
}
