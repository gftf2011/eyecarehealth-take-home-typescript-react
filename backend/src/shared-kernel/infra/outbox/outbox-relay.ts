import type { Kysely } from 'kysely';

import type { Clock, MessagePublisher } from '../../application';
import type { OutboxDatabase } from './outbox-events.table';

export type RelayBatchResult = {
  readonly published: number;
  /** 0 ou 1: o lote para na primeira falha (ver `relayBatch`). */
  readonly failed: number;
};

/** O que o loop do relay precisa a cada ciclo (permite testá-lo com um fake). */
export interface OutboxRelayCycle {
  relayBatch(limit: number): Promise<RelayBatchResult>;
  purgePublishedBefore(instant: Date): Promise<number>;
}

/**
 * Entrega as mensagens do outbox ao broker (transactional outbox, lado da
 * leitura). Garantia: **pelo menos uma vez** — se o commit falhar depois de
 * publicar, a mensagem sai de novo; o consumidor deduplica pelo `id`.
 */
export class OutboxRelay implements OutboxRelayCycle {
  constructor(
    private readonly db: Kysely<OutboxDatabase>,
    private readonly publisher: MessagePublisher,
    private readonly clock: Clock,
  ) {}

  /**
   * Publica até `limit` mensagens pendentes, das mais antigas para as mais
   * novas (índice parcial `idx_outbox_events_pending`).
   *
   * - `FOR UPDATE SKIP LOCKED`: réplicas do relay pegam lotes disjuntos, sem
   *   esperar umas pelas outras nem publicar a mesma mensagem duas vezes.
   * - Para na primeira falha: com o broker fora, as demais falhariam também, e
   *   seguir adiante publicaria atualizações de um pedido fora de ordem. A que
   *   falhou soma uma tentativa; nenhuma é descartada.
   */
  async relayBatch(limit: number): Promise<RelayBatchResult> {
    return this.db.transaction().execute(async (trx) => {
      const pending = await trx
        .selectFrom('outbox_events')
        .select(['id', 'aggregate_type', 'aggregate_id', 'event_name', 'event_version', 'payload', 'occurred_at'])
        .where('published_at', 'is', null)
        .orderBy('occurred_at')
        .orderBy('id')
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();

      const publishedIds: string[] = [];
      let failedId: string | null = null;
      for (const row of pending) {
        try {
          await this.publisher.publish({
            id: row.id,
            topic: row.event_name,
            version: row.event_version,
            aggregateType: row.aggregate_type,
            aggregateId: row.aggregate_id,
            payload: row.payload,
            occurredAt: row.occurred_at,
          });
          publishedIds.push(row.id);
        } catch {
          failedId = row.id;
          break;
        }
      }

      if (publishedIds.length > 0) {
        await trx
          .updateTable('outbox_events')
          .set({ published_at: this.clock.now() })
          .where('id', 'in', publishedIds)
          .execute();
      }
      if (failedId !== null) {
        await trx
          .updateTable('outbox_events')
          .set((eb) => ({ attempts: eb('attempts', '+', 1) }))
          .where('id', '=', failedId)
          .execute();
      }

      return { published: publishedIds.length, failed: failedId === null ? 0 : 1 };
    });
  }

  /** Remove mensagens já entregues antes de `instant` (retenção do outbox). */
  async purgePublishedBefore(instant: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('outbox_events')
      .where('published_at', 'is not', null)
      .where('published_at', '<', instant)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}
