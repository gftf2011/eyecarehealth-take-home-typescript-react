import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { MessagePublisher, OutboxMessage, PublishedMessage } from '../../application';
import { FixedClock } from '../../application/testing/fixed-clock';
import { connectToTestRedis } from '../cache/redis/testing/test-redis';
import { RedisMessagePublisher, type MessageEnvelope } from '../cache/redis/redis-message.publisher';
import type { RedisConnection } from '../cache/redis/redis-connection';
import { connectToTestDatabase, resetDatabase } from '../database/testing/test-database';
import { KyselyOutboxWriter } from './kysely-outbox.writer';
import type { OutboxDatabase } from './outbox-events.table';
import { OutboxRelay } from './outbox-relay';

const db = connectToTestDatabase<OutboxDatabase>();
const NOW = new Date('2025-01-20T12:00:00Z');
const TOPIC = 'ordering.order-updates';

function message(n: number): OutboxMessage {
  return {
    id: randomUUID(),
    aggregateType: 'ordering.order',
    aggregateId: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
    eventName: TOPIC,
    eventVersion: 1,
    payload: { type: 'order.placed', n },
    // Uma por segundo: a ordem de `occurred_at` é a ordem de `n`.
    occurredAt: new Date(NOW.getTime() - 10_000_000 + n * 1_000),
  };
}

async function givenPending(count: number): Promise<OutboxMessage[]> {
  const messages = Array.from({ length: count }, (_, n) => message(n));
  await new KyselyOutboxWriter(db).append(messages);
  return messages;
}

/** Publisher em memória: registra o que publicou e pode falhar sob demanda. */
class RecordingPublisher implements MessagePublisher {
  readonly published: PublishedMessage[] = [];
  failWhen: (message: PublishedMessage) => boolean = () => false;

  async publish(published: PublishedMessage): Promise<void> {
    if (this.failWhen(published)) throw new Error('broker fora do ar');
    this.published.push(published);
  }
}

async function pendingCount(): Promise<number> {
  const rows = await db.selectFrom('outbox_events').select('id').where('published_at', 'is', null).execute();
  return rows.length;
}

describe('OutboxRelay', () => {
  let redis: RedisConnection;

  beforeAll(async () => {
    redis = await connectToTestRedis();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await redis.close();
    await db.destroy();
  });

  it('publica no Redis em ordem e marca como entregues', async () => {
    const prefix = `test:${randomUUID()}:`;
    const subscriber = new Redis(inject('redisUrl'));
    const received: MessageEnvelope[] = [];
    await subscriber.subscribe(`${prefix}${TOPIC}`);
    subscriber.on('message', (_channel, body: string) => received.push(JSON.parse(body) as MessageEnvelope));
    const messages = await givenPending(3);
    const relay = new OutboxRelay(db, new RedisMessagePublisher(redis, prefix), new FixedClock(NOW));

    const result = await relay.relayBatch(10);
    await expect.poll(() => received.length).toBe(3);
    await subscriber.quit();

    expect(result).toEqual({ published: 3, failed: 0 });
    expect(received.map((envelope) => envelope.id)).toEqual(messages.map((m) => m.id));
    expect(received[0]).toEqual({
      id: messages[0]?.id,
      topic: TOPIC,
      version: 1,
      aggregateId: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
      occurredAt: messages[0]?.occurredAt.toISOString(),
      payload: { type: 'order.placed', n: 0 },
    });
    const rows = await db.selectFrom('outbox_events').select('published_at').execute();
    expect(rows.every((row) => row.published_at?.getTime() === NOW.getTime())).toBe(true);
  });

  it('respeita o tamanho do lote e não republica o que já foi entregue', async () => {
    await givenPending(5);
    const publisher = new RecordingPublisher();
    const relay = new OutboxRelay(db, publisher, new FixedClock(NOW));

    expect(await relay.relayBatch(2)).toEqual({ published: 2, failed: 0 });
    expect(await relay.relayBatch(10)).toEqual({ published: 3, failed: 0 });
    expect(await relay.relayBatch(10)).toEqual({ published: 0, failed: 0 });
    expect(publisher.published.map((m) => m.payload['n'])).toEqual([0, 1, 2, 3, 4]);
  });

  it('para na primeira falha, soma a tentativa e entrega tudo em ordem quando o broker volta', async () => {
    await givenPending(4);
    const publisher = new RecordingPublisher();
    publisher.failWhen = (m) => m.payload['n'] === 1;
    const relay = new OutboxRelay(db, publisher, new FixedClock(NOW));

    expect(await relay.relayBatch(10)).toEqual({ published: 1, failed: 1 });
    const attempts = await db.selectFrom('outbox_events').select(['payload', 'attempts']).execute();
    expect(attempts.map((row) => [row.payload['n'], row.attempts]).sort()).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 0],
    ]);
    expect(await pendingCount()).toBe(3);

    publisher.failWhen = () => false;
    expect(await relay.relayBatch(10)).toEqual({ published: 3, failed: 0 });
    expect(publisher.published.map((m) => m.payload['n'])).toEqual([0, 1, 2, 3]);
  });

  it('duas réplicas em paralelo pegam lotes disjuntos: cada mensagem sai uma vez só', async () => {
    const messages = await givenPending(200);
    const publisher = new RecordingPublisher();
    // Pool próprio para a segunda réplica: conexões (e transações) independentes.
    const replicaDb = connectToTestDatabase<OutboxDatabase>();
    const relays = [
      new OutboxRelay(db, publisher, new FixedClock(NOW)),
      new OutboxRelay(replicaDb, publisher, new FixedClock(NOW)),
    ];

    const drain = async (relay: OutboxRelay): Promise<void> => {
      while ((await relay.relayBatch(15)).published > 0) {
        // continua até esvaziar
      }
    };
    await Promise.all(relays.map(drain));
    await replicaDb.destroy();

    const ids = publisher.published.map((m) => m.id);
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
    expect(new Set(ids)).toEqual(new Set(messages.map((m) => m.id)));
    expect(await pendingCount()).toBe(0);
  });

  it('Redis fora do ar: nada é marcado como entregue', async () => {
    await givenPending(2);
    const offline = new OutboxRelay(
      db,
      { publish: async () => Promise.reject(new Error('ECONNREFUSED')) },
      new FixedClock(NOW),
    );

    expect(await offline.relayBatch(10)).toEqual({ published: 0, failed: 1 });
    expect(await pendingCount()).toBe(2);
  });

  it('a retenção remove só as entregues antes do corte', async () => {
    await givenPending(3);
    const relay = new OutboxRelay(db, new RecordingPublisher(), new FixedClock(NOW));
    await relay.relayBatch(2);

    const removed = await relay.purgePublishedBefore(new Date(NOW.getTime() + 1));

    expect(removed).toBe(2);
    expect(await pendingCount()).toBe(1);
    expect(await db.selectFrom('outbox_events').select('id').execute()).toHaveLength(1);
  });
});
