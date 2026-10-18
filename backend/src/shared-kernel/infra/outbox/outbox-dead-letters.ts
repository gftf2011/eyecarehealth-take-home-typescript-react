import type { Kysely } from 'kysely';

import type { OutboxDatabase } from './outbox-events.table';

/** Mensagem na fila morta, como aparece na listagem para investigação. */
export type DeadLetter = {
  readonly id: string;
  readonly topic: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly occurredAt: Date;
  readonly deadLetteredAt: Date;
};

/**
 * Fila morta do outbox: listar o que o relay desistiu de publicar e devolver
 * à fila depois de corrigida a causa. A mensagem devolvida volta com as
 * tentativas zeradas e sai na ordem original (`occurred_at`).
 */
export class OutboxDeadLetters {
  constructor(private readonly db: Kysely<OutboxDatabase>) {}

  async list(limit = 100): Promise<DeadLetter[]> {
    const rows = await this.db
      .selectFrom('outbox_events')
      .select(['id', 'event_name', 'aggregate_type', 'aggregate_id', 'attempts', 'last_error', 'occurred_at', 'dead_lettered_at'])
      .where('dead_lettered_at', 'is not', null)
      .orderBy('dead_lettered_at')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      topic: row.event_name,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      attempts: row.attempts,
      lastError: row.last_error,
      occurredAt: row.occurred_at,
      deadLetteredAt: row.dead_lettered_at ?? row.occurred_at,
    }));
  }

  /** Devolve à fila as mensagens indicadas, ou todas sem `ids`. Retorna quantas voltaram. */
  async redrive(ids?: readonly string[]): Promise<number> {
    if (ids?.length === 0) return 0;
    let query = this.db
      .updateTable('outbox_events')
      .set({ dead_lettered_at: null, attempts: 0 })
      .where('dead_lettered_at', 'is not', null);
    if (ids !== undefined) query = query.where('id', 'in', ids);
    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows);
  }
}
