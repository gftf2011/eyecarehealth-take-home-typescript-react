import { sql, type Kysely } from 'kysely';

import type { Clock, MessagePublisher } from '../../application';
import type { JsonObject } from '../../domain';
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

/** Linha pendente como a seleção do relay a lê. */
type PendingRow = {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_name: string;
  readonly event_version: number;
  readonly payload: JsonObject;
  readonly occurred_at: Date;
  readonly attempts: number;
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
   * Publica até `limit` mensagens pendentes, na ordem de inserção
   * (`sequence`), para o SNS FIFO entregá-las em ordem por agregado.
   *
   * - **Um agregado por réplica:** a transação pega um advisory lock por
   *   agregado (`pg_try_advisory_xact_lock`) e só publica os agregados que
   *   conseguiu travar. Duas réplicas nunca publicam mensagens do mesmo pedido
   *   ao mesmo tempo (o que inverteria a ordem), e agregados diferentes
   *   continuam divididos entre elas.
   * - O lote inteiro vai ao publisher de uma vez (`PublishBatch` de 10 em 10,
   *   uma faixa sequencial por grupo), com um resultado por mensagem: as
   *   entregues saem da fila, as que falharam ficam.
   * - Broker fora (`broker-unavailable`) ou esperando uma anterior do mesmo
   *   agregado (`deferred`): fica pendente sem contar tentativa.
   * - Recusa da mensagem (`rejected`): soma uma tentativa. Na
   *   `maxAttempts`-ésima, vai para a **fila morta** (`dead_lettered_at`) e o
   *   agregado destrava: as seguintes dele voltam a sair.
   */
  async relayBatch(limit: number): Promise<RelayBatchResult> {
    const { result, deadLettered } = await this.db.transaction().execute(async (trx) => {
      const { rows: pending } = await sql<PendingRow>`
        WITH heads AS (
          SELECT aggregate_type, aggregate_id, min(sequence) AS first_sequence
          FROM outbox_events
          WHERE published_at IS NULL AND dead_lettered_at IS NULL
          GROUP BY aggregate_type, aggregate_id
          ORDER BY first_sequence
          LIMIT ${limit}
        ), owned AS MATERIALIZED (
          SELECT aggregate_type, aggregate_id
          FROM heads
          WHERE pg_try_advisory_xact_lock(hashtextextended(aggregate_type || ':' || aggregate_id::text, 0))
        )
        SELECT e.id, e.aggregate_type, e.aggregate_id, e.event_name, e.event_version, e.payload, e.occurred_at, e.attempts
        FROM outbox_events e
        JOIN owned o ON o.aggregate_type = e.aggregate_type AND o.aggregate_id = e.aggregate_id
        WHERE e.published_at IS NULL AND e.dead_lettered_at IS NULL
        ORDER BY e.sequence
        LIMIT ${limit}
        FOR UPDATE OF e
      `.execute(trx);

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
        // broker-unavailable ou deferred: pendente, sem contar tentativa.
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

