import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MessagePublisher, PublishedMessage, PublishOutcome } from '../../application';
import { FixedClock } from '../../application/testing/fixed-clock';
import { connectToTestDatabase, resetDatabase } from '../database/testing/test-database';
import type { OutboxDatabase } from './outbox-events.table';
import { OutboxRelay } from './outbox-relay';

const db = connectToTestDatabase<OutboxDatabase>();

/** O backlog de um seed em massa: 100 mil pedidos com 4 eventos cada. */
const AGGREGATES = 100_000;
const EVENTS_PER_AGGREGATE = 4;
const BATCH = 500;
const MEASURED_BATCHES = 20;
/**
 * Mediana do lote inteiro (selecionar, travar e marcar como entregue), sem a
 * rede: o broker é instantâneo. Agrupando todas as pendentes a cada lote, a
 * versão anterior levava 56–88 ms aqui; lendo só a janela do começo da fila,
 * 10–27 ms.
 */
const MAX_MEDIAN_BATCH_MS = 30;

/** Aceita tudo na hora e guarda a ordem de envio: isola o custo do banco. */
class InstantPublisher implements MessagePublisher {
  readonly published: PublishedMessage[] = [];

  publishBatch(messages: readonly PublishedMessage[]): Promise<readonly PublishOutcome[]> {
    this.published.push(...messages);
    return Promise.resolve(messages.map((message): PublishOutcome => ({ id: message.id, status: 'published' })));
  }
}

describe(`OutboxRelay com ${AGGREGATES * EVENTS_PER_AGGREGATE} mensagens pendentes`, () => {
  beforeAll(async () => {
    await resetDatabase(db);
    // Na ordem em que um seed em massa grava: os eventos de cada pedido em sequência.
    await sql`
      INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_name, event_version, payload, occurred_at)
      SELECT
        gen_random_uuid(),
        'ordering.order',
        ('00000000-0000-4000-8000-' || lpad((n / ${EVENTS_PER_AGGREGATE})::text, 12, '0'))::uuid,
        'ordering.order-updates',
        1,
        jsonb_build_object('type', 'order.status-changed', 'step', n % ${EVENTS_PER_AGGREGATE}),
        timestamptz '2025-01-20 12:00:00+00' + n * interval '1 millisecond'
      FROM generate_series(0, ${AGGREGATES * EVENTS_PER_AGGREGATE - 1}) AS n
      ORDER BY n
    `.execute(db);
    await sql`VACUUM ANALYZE outbox_events`.execute(db);
  }, 120_000);

  afterAll(async () => {
    await resetDatabase(db);
    await db.destroy();
  });

  it(`cada lote de ${BATCH} custa o mesmo com o backlog cheio, sem varrer as pendentes`, async () => {
    const publisher = new InstantPublisher();
    const relay = new OutboxRelay(db, publisher, new FixedClock(new Date('2025-01-20T13:00:00Z')));

    const durations: number[] = [];
    for (let batch = 0; batch < MEASURED_BATCHES; batch += 1) {
      const startedAt = performance.now();
      const { published } = await relay.relayBatch(BATCH);
      durations.push(performance.now() - startedAt);
      expect(published).toBe(BATCH);
    }

    // Mediana: um lote isolado pode pegar uma pausa do Docker ou do GC.
    const sorted = [...durations].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(MAX_MEDIAN_BATCH_MS);
    // Nenhuma repetida, e cada pedido na ordem dos próprios eventos.
    const steps = new Map<string, number>();
    for (const message of publisher.published) {
      const step = Number(message.payload['step']);
      expect(step).toBe((steps.get(message.aggregateId) ?? -1) + 1);
      steps.set(message.aggregateId, step);
    }
    expect(new Set(publisher.published.map((message) => message.id)).size).toBe(BATCH * MEASURED_BATCHES);
  });
});
