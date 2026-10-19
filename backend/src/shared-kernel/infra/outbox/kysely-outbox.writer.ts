import type { Kysely, Transaction } from 'kysely';

import type { OutboxMessage, OutboxWriter } from '../../application/ports/outbox-writer';
import { currentTraceCarrier } from '../observability/telemetry';
import type { OutboxDatabase } from './outbox-events.table';

/**
 * Outbox em PostgreSQL usando a **mesma** transação das escritas do caso de
 * uso: ou ambos são confirmados, ou nenhum. O `id` da mensagem é a chave
 * primária, então gravar a mesma mensagem duas vezes falha em vez de duplicar.
 */
export class KyselyOutboxWriter implements OutboxWriter {
  constructor(private readonly trx: Transaction<OutboxDatabase> | Kysely<OutboxDatabase>) {}

  async append(messages: readonly OutboxMessage[]): Promise<void> {
    if (messages.length === 0) return;
    // O caso de uso roda dentro do trace da requisição: o relay continua dele.
    const traceCarrier = currentTraceCarrier();

    await this.trx
      .insertInto('outbox_events')
      .values(
        messages.map((message) => ({
          id: message.id,
          aggregate_type: message.aggregateType,
          aggregate_id: message.aggregateId,
          event_name: message.eventName,
          event_version: message.eventVersion,
          payload: JSON.stringify(message.payload),
          occurred_at: message.occurredAt,
          trace_context: traceCarrier === null ? null : JSON.stringify(traceCarrier),
        })),
      )
      .execute();
  }
}
