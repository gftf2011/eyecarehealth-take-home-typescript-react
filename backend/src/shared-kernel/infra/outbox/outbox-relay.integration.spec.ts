import { randomUUID } from 'node:crypto';

import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { MessagePublisher, OutboxMessage, PublishedMessage, PublishOutcome } from '../../application';
import { FixedClock } from '../../application/testing/fixed-clock';
import { connectToTestDatabase, resetDatabase } from '../database/testing/test-database';
import { KyselyOutboxWriter } from './kysely-outbox.writer';
import type { OutboxDatabase } from './outbox-events.table';
import { createSnsClient } from '../messaging/aws/aws-clients';
import { SnsMessagePublisher } from '../messaging/aws/sns-message.publisher';
import { createTestMessaging, testAwsConfig } from '../messaging/aws/testing/test-aws';
import type { MessageEnvelope } from '../messaging/message-envelope';
import { OutboxDeadLetters } from './outbox-dead-letters';
import { OutboxRelay, type DeadLetteredMessage } from './outbox-relay';

const db = connectToTestDatabase<OutboxDatabase>();
const NOW = new Date('2025-01-20T12:00:00Z');
const TOPIC = 'ordering.order-updates';

const ORDER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';

function message(n: number, aggregateId = ORDER_ID): OutboxMessage {
  return {
    id: randomUUID(),
    aggregateType: 'ordering.order',
    aggregateId,
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
  readonly batches: number[] = [];
  /** Demora de cada lote: deixa as transações de réplicas diferentes se sobreporem. */
  delayMs = 0;
  failWhen: (message: PublishedMessage) => boolean = () => false;
  /** Como falha quando `failWhen` casa: por padrão, recusa da mensagem (permanente). */
  failAs: 'rejected' | 'broker-unavailable' | 'deferred' = 'rejected';

  async publishBatch(messages: readonly PublishedMessage[]): Promise<readonly PublishOutcome[]> {
    this.batches.push(messages.length);
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return messages.map((message): PublishOutcome => {
      if (this.failWhen(message)) return { id: message.id, status: this.failAs, reason: 'payload recusado' };
      this.published.push(message);
      return { id: message.id, status: 'published' };
    });
  }
}

async function pendingCount(): Promise<number> {
  const rows = await db.selectFrom('outbox_events').select('id').where('published_at', 'is', null).execute();
  return rows.length;
}

describe('OutboxRelay', () => {
  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('publica no SNS em ordem, a fila assinante recebe o envelope e as mensagens ficam entregues', async () => {
    const messaging = await createTestMessaging();
    const received: MessageEnvelope[] = [];
    const messages = await givenPending(3);
    const relay = new OutboxRelay(db, new SnsMessagePublisher(messaging.sns, messaging.topicArn), new FixedClock(NOW));

    const result = await relay.relayBatch(10);
    await expect
      .poll(async () => {
        const { Messages = [] } = await messaging.sqs.send(
          new ReceiveMessageCommand({ QueueUrl: messaging.queue.url, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }),
        );
        received.push(...Messages.map((message) => JSON.parse(message.Body ?? '') as MessageEnvelope));
        return received.length;
      })
      .toBe(3);

    expect(result).toEqual({ published: 3, failed: 0 });
    // Fila padrão: a ordem de chegada não é garantida (o painel só recarrega).
    expect(new Set(received.map((envelope) => envelope.id))).toEqual(new Set(messages.map((m) => m.id)));
    expect(received.find((envelope) => envelope.id === messages[0]?.id)).toEqual({
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

  it('manda o lote inteiro de uma vez; a recusada soma tentativa sem segurar as outras', async () => {
    await givenPending(4);
    const publisher = new RecordingPublisher();
    publisher.failWhen = (m) => m.payload['n'] === 1;
    const relay = new OutboxRelay(db, publisher, new FixedClock(NOW));

    expect(await relay.relayBatch(10)).toEqual({ published: 3, failed: 1 });
    expect(publisher.batches).toEqual([4]);
    const attempts = await db.selectFrom('outbox_events').select(['payload', 'attempts']).execute();
    expect(attempts.map((row) => [row.payload['n'], row.attempts]).sort()).toEqual([
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 0],
    ]);
    expect(await pendingCount()).toBe(1);

    publisher.failWhen = () => false;
    expect(await relay.relayBatch(10)).toEqual({ published: 1, failed: 0 });
    expect(publisher.published.map((m) => m.payload['n'])).toEqual([0, 2, 3, 1]);
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

  it('SNS fora do ar: nada é entregue e a queda não conta tentativa', async () => {
    await givenPending(2);
    const unreachable = createSnsClient({ ...testAwsConfig(), endpoint: 'http://127.0.0.1:1' });
    const offline = new OutboxRelay(
      db,
      new SnsMessagePublisher(unreachable, 'arn:aws:sns:us-east-1:000000000000:qualquer'),
      new FixedClock(NOW),
      { maxAttempts: 1 },
    );

    for (let cycle = 0; cycle < 3; cycle += 1) {
      expect(await offline.relayBatch(10)).toEqual({ published: 0, failed: 2 });
    }
    unreachable.destroy();

    expect(await pendingCount()).toBe(2);
    const rows = await db.selectFrom('outbox_events').select(['attempts', 'dead_lettered_at']).execute();
    expect(rows).toEqual([
      { attempts: 0, dead_lettered_at: null },
      { attempts: 0, dead_lettered_at: null },
    ]);
  });

  describe('ordem FIFO', () => {
    it('publica na ordem de inserção (sequence), mesmo com occurred_at fora de ordem', async () => {
      // Relógios de transações diferentes podem empatar ou inverter.
      const later = { ...message(0), occurredAt: new Date(NOW.getTime() + 60_000) };
      const earlier = { ...message(1), occurredAt: NOW };
      await new KyselyOutboxWriter(db).append([later]);
      await new KyselyOutboxWriter(db).append([earlier]);
      const publisher = new RecordingPublisher();

      await new OutboxRelay(db, publisher, new FixedClock(NOW)).relayBatch(10);

      expect(publisher.published.map((m) => m.id)).toEqual([later.id, earlier.id]);
    });

    it('mensagem adiada (anterior do mesmo pedido falhou) fica pendente sem contar tentativa', async () => {
      await givenPending(2);
      const publisher = new RecordingPublisher();
      publisher.failWhen = (m) => m.payload['n'] === 1;
      publisher.failAs = 'deferred';
      const relay = new OutboxRelay(db, publisher, new FixedClock(NOW), { maxAttempts: 1 });

      expect(await relay.relayBatch(10)).toEqual({ published: 1, failed: 1 });

      const rows = await db.selectFrom('outbox_events').select(['attempts', 'dead_lettered_at']).where('published_at', 'is', null).execute();
      expect(rows).toEqual([{ attempts: 0, dead_lettered_at: null }]);
    });

    it('duas réplicas nunca publicam o mesmo pedido ao mesmo tempo: a ordem de cada pedido se mantém', async () => {
      const orders = [randomUUID(), randomUUID(), randomUUID()];
      const messages = orders.flatMap((order, o) => Array.from({ length: 15 }, (_, n) => message(o * 100 + n, order)));
      await new KyselyOutboxWriter(db).append(messages);
      const publisher = new RecordingPublisher();
      publisher.delayMs = 20;
      const replicaDb = connectToTestDatabase<OutboxDatabase>();
      const relays = [
        new OutboxRelay(db, publisher, new FixedClock(NOW)),
        new OutboxRelay(replicaDb, publisher, new FixedClock(NOW)),
      ];

      const drain = async (relay: OutboxRelay): Promise<void> => {
        for (let idle = 0; idle < 3; ) {
          const { published } = await relay.relayBatch(4);
          idle = published === 0 ? idle + 1 : 0;
        }
      };
      await Promise.all(relays.map(drain));
      await replicaDb.destroy();

      expect(publisher.published).toHaveLength(messages.length);
      for (const order of orders) {
        const sent = publisher.published.filter((m) => m.aggregateId === order).map((m) => m.payload['n']);
        const expected = messages.filter((m) => m.aggregateId === order).map((m) => m.payload['n']);
        expect(sent).toEqual(expected);
      }
    });
  });

  describe('fila morta', () => {
    const MAX_ATTEMPTS = 3;

    async function poisonedRelay(deadLettered: DeadLetteredMessage[] = []) {
      const publisher = new RecordingPublisher();
      publisher.failWhen = (m) => m.payload['n'] === 1;
      const relay = new OutboxRelay(db, publisher, new FixedClock(NOW), {
        maxAttempts: MAX_ATTEMPTS,
        onDeadLettered: (message) => deadLettered.push(message),
      });
      return { publisher, relay };
    }

    it('na última tentativa, a mensagem defeituosa sai da fila e as seguintes são entregues', async () => {
      const messages = await givenPending(3);
      const deadLettered: DeadLetteredMessage[] = [];
      const { publisher, relay } = await poisonedRelay(deadLettered);

      expect(await relay.relayBatch(10)).toEqual({ published: 2, failed: 1 });
      expect(await relay.relayBatch(10)).toEqual({ published: 0, failed: 1 });
      expect(deadLettered).toEqual([]);
      expect(await relay.relayBatch(10)).toEqual({ published: 0, failed: 0 });

      expect(publisher.published.map((m) => m.payload['n'])).toEqual([0, 2]);
      expect(await pendingCount()).toBe(1);
      const dead = await db
        .selectFrom('outbox_events')
        .select(['id', 'attempts', 'last_error', 'dead_lettered_at'])
        .where('dead_lettered_at', 'is not', null)
        .execute();
      expect(dead).toEqual([
        { id: messages[1]?.id, attempts: MAX_ATTEMPTS, last_error: 'payload recusado', dead_lettered_at: NOW },
      ]);
      expect(deadLettered).toEqual([
        {
          id: messages[1]?.id,
          topic: TOPIC,
          aggregateId: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
          attempts: MAX_ATTEMPTS,
          error: 'payload recusado',
        },
      ]);

      expect(await relay.relayBatch(10)).toEqual({ published: 0, failed: 0 });
    });

    it('queda do broker no meio não adianta a morte de uma mensagem', async () => {
      await givenPending(2);
      const { publisher, relay } = await poisonedRelay();
      publisher.failAs = 'broker-unavailable';

      for (let cycle = 0; cycle < MAX_ATTEMPTS + 2; cycle += 1) await relay.relayBatch(10);

      const rows = await db.selectFrom('outbox_events').select(['attempts', 'dead_lettered_at']).execute();
      expect(rows.every((row) => row.attempts === 0 && row.dead_lettered_at === null)).toBe(true);
    });

    it('a retenção não apaga mensagens mortas', async () => {
      await givenPending(3);
      const { relay } = await poisonedRelay();
      for (let cycle = 0; cycle < MAX_ATTEMPTS; cycle += 1) await relay.relayBatch(10);

      await relay.purgePublishedBefore(new Date(NOW.getTime() + 1));

      expect(await new OutboxDeadLetters(db).list()).toHaveLength(1);
    });

    it('lista as mortas e, corrigida a causa, o redrive as devolve à fila', async () => {
      const messages = await givenPending(3);
      const { publisher, relay } = await poisonedRelay();
      for (let cycle = 0; cycle < MAX_ATTEMPTS; cycle += 1) await relay.relayBatch(10);
      const deadLetters = new OutboxDeadLetters(db);

      expect(await deadLetters.list()).toEqual([
        expect.objectContaining({ id: messages[1]?.id, topic: TOPIC, attempts: MAX_ATTEMPTS, deadLetteredAt: NOW }),
      ]);

      publisher.failWhen = () => false;
      expect(await deadLetters.redrive([randomUUID()])).toBe(0);
      expect(await deadLetters.redrive()).toBe(1);
      expect(await deadLetters.list()).toEqual([]);

      expect(await relay.relayBatch(10)).toEqual({ published: 1, failed: 0 });
      expect(publisher.published.map((m) => m.payload['n'])).toEqual([0, 2, 1]);
      expect(await pendingCount()).toBe(0);
    });
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
