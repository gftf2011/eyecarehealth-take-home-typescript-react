import { SpanKind, SpanStatusCode, trace, type Link } from '@opentelemetry/api';
import { sql, type Kysely, type Transaction } from 'kysely';

import type { Clock, MessagePublisher } from '../../application';
import type { JsonObject } from '../../domain';
import { contextFromCarrier, lazily, meter, tracer } from '../observability/telemetry';
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
  readonly trace_context: Record<string, string> | null;
};

/** Métricas do relay (no-op sem o SDK do OpenTelemetry). */
const instruments = lazily(() => ({
  published: meter().createCounter('fastmeals.outbox.messages.published', {
    description: 'Mensagens do outbox entregues ao broker',
    unit: '{message}',
  }),
  failed: meter().createCounter('fastmeals.outbox.messages.failed', {
    description: 'Mensagens que ficaram pendentes num ciclo, por motivo',
    unit: '{message}',
  }),
  deadLettered: meter().createCounter('fastmeals.outbox.messages.dead_lettered', {
    description: 'Mensagens enviadas para a fila morta do outbox',
    unit: '{message}',
  }),
  deliveryLag: meter().createHistogram('fastmeals.outbox.delivery.lag', {
    description: 'Tempo entre o evento acontecer e a mensagem sair para o broker',
    unit: 'ms',
  }),
  batchDuration: meter().createHistogram('fastmeals.outbox.batch.duration', {
    description: 'Duração de um ciclo do relay com mensagens',
    unit: 'ms',
  }),
}));

export const DEFAULT_OUTBOX_MAX_ATTEMPTS = 5;
/** Teto do erro guardado na linha (a pilha inteira não ajuda a investigar). */
const MAX_ERROR_LENGTH = 2_000;
/**
 * A janela de candidatas é 5 vezes o lote: sobra o que escolher quando outra
 * réplica já travou os agregados mais antigos.
 */
const CANDIDATE_WINDOW = 5;

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
   * - **Custo do tamanho do lote, não do backlog:** a escolha começa pelas
   *   `limit × 5` pendentes mais antigas (`ORDER BY sequence LIMIT`, no
   *   índice parcial), nunca por um agrupamento de todas as pendentes. A
   *   ordem continua certa: se uma mensagem de um agregado está nessa janela,
   *   a primeira pendente dele também está, porque é mais antiga.
   * - **Um agregado por réplica:** a transação pega um advisory lock por
   *   agregado (`pg_try_advisory_xact_lock`), do mais antigo para o mais novo,
   *   até `limit` agregados, e só publica os que conseguiu travar. Duas
   *   réplicas nunca publicam mensagens do mesmo pedido ao mesmo tempo (o que
   *   inverteria a ordem); a janela maior que o lote deixa a segunda réplica
   *   achar agregados livres em vez de voltar de mãos vazias.
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
        WITH oldest AS (
          SELECT aggregate_type, aggregate_id, sequence
          FROM outbox_events
          WHERE published_at IS NULL AND dead_lettered_at IS NULL
          ORDER BY sequence
          LIMIT ${limit * CANDIDATE_WINDOW}
        ), heads AS (
          SELECT aggregate_type, aggregate_id, min(sequence) AS first_sequence
          FROM oldest
          GROUP BY aggregate_type, aggregate_id
        ), owned AS MATERIALIZED (
          SELECT aggregate_type, aggregate_id
          FROM (SELECT * FROM heads ORDER BY first_sequence OFFSET 0) AS ordered
          WHERE pg_try_advisory_xact_lock(hashtextextended(aggregate_type || ':' || aggregate_id::text, 0))
          LIMIT ${limit}
        )
        SELECT e.id, e.aggregate_type, e.aggregate_id, e.event_name, e.event_version, e.payload, e.occurred_at, e.attempts,
               e.trace_context
        FROM outbox_events e
        JOIN owned o ON o.aggregate_type = e.aggregate_type AND o.aggregate_id = e.aggregate_id
        WHERE e.published_at IS NULL AND e.dead_lettered_at IS NULL
        ORDER BY e.sequence
        LIMIT ${limit}
        FOR UPDATE OF e
      `.execute(trx);
      // Ciclo vazio (a cada poucos centésimos de segundo): nem span nem métrica.
      if (pending.length === 0) return { result: { published: 0, failed: 0 }, deadLettered: [] };

      // Um span por lote, ligado aos traces das requisições que geraram cada mensagem.
      const links = pending.flatMap((row): Link[] => {
        const spanContext = trace.getSpanContext(contextFromCarrier(row.trace_context));
        return spanContext === undefined ? [] : [{ context: spanContext }];
      });
      return tracer().startActiveSpan(
        'outbox relay batch',
        { kind: SpanKind.INTERNAL, links, attributes: { 'messaging.batch.message_count': pending.length } },
        async (span) => {
          const startedAt = performance.now();
          try {
            const batch = await this.#publish(trx, pending);
            span.setAttributes({
              'fastmeals.outbox.published': batch.result.published,
              'fastmeals.outbox.failed': batch.result.failed,
            });
            if (batch.result.failed > 0) span.setStatus({ code: SpanStatusCode.ERROR, message: 'mensagens pendentes' });
            return batch;
          } finally {
            instruments().batchDuration.record(performance.now() - startedAt);
            span.end();
          }
        },
      );
    });
    // Só depois do commit: o aviso corresponde ao que de fato ficou gravado.
    for (const message of deadLettered) this.#onDeadLettered(message);
    return result;
  }

  /** Publica o lote travado e grava o resultado de cada mensagem, na mesma transação. */
  async #publish(
    trx: Transaction<OutboxDatabase>,
    pending: readonly PendingRow[],
  ): Promise<{ result: RelayBatchResult; deadLettered: DeadLetteredMessage[] }> {
    {
      const outcomes = await this.publisher.publishBatch(
        pending.map((row) => ({
          id: row.id,
          topic: row.event_name,
          version: row.event_version,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          occurredAt: row.occurred_at,
          traceContext: row.trace_context,
        })),
      );
      const outcomeOf = new Map(outcomes.map((outcome) => [outcome.id, outcome]));

      const publishedIds: string[] = [];
      const movedToDeadLetter: DeadLetteredMessage[] = [];
      let failed = 0;
      for (const row of pending) {
        const outcome = outcomeOf.get(row.id);
        if (outcome?.status === 'published') {
          publishedIds.push(row.id);
          instruments().published.add(1, { 'messaging.destination.name': row.event_name });
          instruments().deliveryLag.record(this.clock.now().getTime() - row.occurred_at.getTime(), {
            'messaging.destination.name': row.event_name,
          });
          continue;
        }
        instruments().failed.add(1, { reason: outcome?.status ?? 'broker-unavailable' });
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
        if (dead) {
          movedToDeadLetter.push({ id: row.id, topic: row.event_name, aggregateId: row.aggregate_id, attempts, error });
          instruments().deadLettered.add(1, { 'messaging.destination.name': row.event_name });
        }
        else failed += 1;
      }

      if (publishedIds.length > 0) {
        await trx
          .updateTable('outbox_events')
          .set({ published_at: this.clock.now() })
          .where('id', 'in', publishedIds)
          .execute();
      }
      return { result: { published: publishedIds.length, failed }, deadLettered: movedToDeadLetter };
    }
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

