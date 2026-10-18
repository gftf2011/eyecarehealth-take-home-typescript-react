import type { Kysely } from 'kysely';

import type { Clock, MessagePublisher } from '../../application';
import type { OutboxDatabase } from './outbox-events.table';

export type RelayBatchResult = {
  readonly published: number;
  /** Mensagens que falharam e continuam pendentes (o loop espera com backoff). */
  readonly failed: number;
};

/** O que o loop do relay precisa a cada ciclo (permite testá-lo com um fake). */
export interface OutboxRelayCycle {
  relayBatch(limit: number): Promise<RelayBatchResult>;
  purgePublishedBefore(instant: Date): Promise<number>;
}

/** Mensagem que esgotou as tentativas e foi para a fila morta. */
export type DeadLetteredMessage = {
  readonly id: string;
  readonly topic: string;
  readonly aggregateId: string;
  readonly attempts: number;
  readonly error: string;
};

export type OutboxRelayOptions = {
  /** Falhas permanentes até desistir da mensagem. Padrão: 5. */
  readonly maxAttempts?: number;
  /** Avisado a cada mensagem que vai para a fila morta (log/alerta). */
  readonly onDeadLettered?: (message: DeadLetteredMessage) => void;
};

export const DEFAULT_OUTBOX_MAX_ATTEMPTS = 5;
/** Teto do erro guardado na linha (a pilha inteira não ajuda a investigar). */
const MAX_ERROR_LENGTH = 2_000;

/**
 * Entrega as mensagens do outbox ao broker (transactional outbox, lado da
 * leitura). Garantia: **pelo menos uma vez** — se o commit falhar depois de
 * publicar, a mensagem sai de novo; o consumidor deduplica pelo `id`.
 */
export class OutboxRelay implements OutboxRelayCycle {
  readonly #maxAttempts: number;
  readonly #onDeadLettered: (message: DeadLetteredMessage) => void;

  constructor(
    private readonly db: Kysely<OutboxDatabase>,
    private readonly publisher: MessagePublisher,
    private readonly clock: Clock,
    { maxAttempts = DEFAULT_OUTBOX_MAX_ATTEMPTS, onDeadLettered = () => undefined }: OutboxRelayOptions = {},
  ) {
    this.#maxAttempts = maxAttempts;
    this.#onDeadLettered = onDeadLettered;
  }

  /**
   * Publica até `limit` mensagens pendentes, das mais antigas para as mais
   * novas (índice parcial `idx_outbox_events_pending`).
   *
   * - `FOR UPDATE SKIP LOCKED`: réplicas do relay pegam lotes disjuntos, sem
   *   esperar umas pelas outras nem publicar a mesma mensagem duas vezes.
   * - O lote inteiro vai ao publisher de uma vez (no SNS, `PublishBatch` de
   *   10 em 10, em paralelo), e cada mensagem tem o próprio resultado: as
   *   entregues saem da fila, as que falharam ficam.
   * - Broker fora (`broker-unavailable`): fica pendente sem contar tentativa.
   * - Recusa da mensagem (`rejected`): soma uma tentativa. Na
   *   `maxAttempts`-ésima, vai para a **fila morta** (`dead_lettered_at`):
   *   uma mensagem defeituosa não trava as outras.
   *
   * Uma falha não segura as demais, então a ordem entre mensagens do mesmo
   * agregado não é garantida — o painel só invalida e recarrega pela API.
   */
  async relayBatch(limit: number): Promise<RelayBatchResult> {
    const { result, deadLettered } = await this.db.transaction().execute(async (trx) => {
      const pending = await trx
        .selectFrom('outbox_events')
        .select(['id', 'aggregate_type', 'aggregate_id', 'event_name', 'event_version', 'payload', 'occurred_at', 'attempts'])
        .where('published_at', 'is', null)
        .where('dead_lettered_at', 'is', null)
        .orderBy('occurred_at')
        .orderBy('id')
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();

      const outcomes = await this.publisher.publishBatch(
        pending.map((row) => ({
          id: row.id,
          topic: row.event_name,
          version: row.event_version,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          occurredAt: row.occurred_at,
        })),
      );
      const outcomeOf = new Map(outcomes.map((outcome) => [outcome.id, outcome]));

      const publishedIds: string[] = [];
      const deadLettered: DeadLetteredMessage[] = [];
      let failed = 0;
      for (const row of pending) {
        const outcome = outcomeOf.get(row.id);
        if (outcome?.status === 'published') {
          publishedIds.push(row.id);
          continue;
        }
        if (outcome?.status !== 'rejected') {
          failed += 1;
          continue;
        }
        const attempts = row.attempts + 1;
        const error = outcome.reason.slice(0, MAX_ERROR_LENGTH);
        const dead = attempts >= this.#maxAttempts;
        await trx
          .updateTable('outbox_events')
          .set({ attempts, last_error: error, dead_lettered_at: dead ? this.clock.now() : null })
          .where('id', '=', row.id)
          .execute();
        if (dead) deadLettered.push({ id: row.id, topic: row.event_name, aggregateId: row.aggregate_id, attempts, error });
        else failed += 1;
      }

      if (publishedIds.length > 0) {
        await trx
          .updateTable('outbox_events')
          .set({ published_at: this.clock.now() })
          .where('id', 'in', publishedIds)
          .execute();
      }
      return { result: { published: publishedIds.length, failed }, deadLettered };
    });
    // Só depois do commit: o aviso corresponde ao que de fato ficou gravado.
    for (const message of deadLettered) this.#onDeadLettered(message);
    return result;
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

