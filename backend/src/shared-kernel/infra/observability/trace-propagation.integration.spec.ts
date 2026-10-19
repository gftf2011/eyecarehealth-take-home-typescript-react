import { randomUUID } from 'node:crypto';

import { context, SpanKind, trace } from '@opentelemetry/api';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../application/testing/fixed-clock';
import { connectToTestDatabase, resetDatabase } from '../database/testing/test-database';
import { SnsMessagePublisher } from '../messaging/aws/sns-message.publisher';
import { SqsQueueConsumer, type QueueMessage } from '../messaging/aws/sqs-queue-consumer';
import { createTestMessaging } from '../messaging/aws/testing/test-aws';
import { SystemClock } from '../clock/system-clock';
import { KyselyOutboxWriter } from '../outbox/kysely-outbox.writer';
import type { OutboxDatabase } from '../outbox/outbox-events.table';
import { OutboxRelay } from '../outbox/outbox-relay';
import { installInMemoryTracing } from './testing/in-memory-telemetry';
import { tracer } from './telemetry';

const tracing = installInMemoryTracing();
const db = connectToTestDatabase<OutboxDatabase>();
const NOW = new Date('2025-01-20T12:00:00Z');

beforeEach(async () => {
  await resetDatabase(db);
  tracing.reset();
});

afterAll(async () => {
  await db.destroy();
});

describe('Trace de ponta a ponta pelo outbox (requisição → relay → SNS → SQS → consumidor)', () => {
  it('o contexto da requisição é gravado com o evento e continua no produtor e no consumidor', async () => {
    const messaging = await createTestMessaging();
    const request = tracer().startSpan('PATCH /api/orders/:id/status', { kind: SpanKind.SERVER });
    const requestContext = request.spanContext();

    // O caso de uso grava o evento dentro do trace da requisição.
    await context.with(trace.setSpan(context.active(), request), () =>
      new KyselyOutboxWriter(db).append([
        {
          id: randomUUID(),
          aggregateType: 'ordering.order',
          aggregateId: randomUUID(),
          eventName: 'ordering.order-updates',
          eventVersion: 1,
          payload: { type: 'order.status-changed' },
          occurredAt: NOW,
        },
      ]),
    );
    request.end();

    const row = await db.selectFrom('outbox_events').select('trace_context').executeTakeFirstOrThrow();
    expect(row.trace_context?.['traceparent']).toContain(requestContext.traceId);

    await new OutboxRelay(db, new SnsMessagePublisher(messaging.sns, messaging.topicArn), new FixedClock(NOW)).relayBatch(10);

    const received: QueueMessage[] = [];
    const consumer = new SqsQueueConsumer(messaging.sqs, {
      queueUrl: messaging.queue.url,
      handle: async (message) => void received.push(message),
      onError: () => undefined,
      clock: new SystemClock(),
      waitTimeSeconds: 1,
    });
    consumer.start();
    await expect.poll(() => received.length, { timeout: 10_000 }).toBe(1);
    await consumer.stop();

    const spans = tracing.spans();
    const producer = spans.find((span) => span.name === 'publish ordering.order-updates');
    const processed = spans.find((span) => span.name.startsWith('process '));
    const batch = spans.find((span) => span.name === 'outbox relay batch');

    // Produtor: filho da requisição, no mesmo trace.
    expect(producer?.kind).toBe(SpanKind.PRODUCER);
    expect(producer?.spanContext().traceId).toBe(requestContext.traceId);
    expect(producer?.parentSpanContext?.spanId).toBe(requestContext.spanId);
    // Consumidor (outro processo em produção): filho do produtor, ainda no mesmo trace.
    expect(processed?.kind).toBe(SpanKind.CONSUMER);
    expect(processed?.spanContext().traceId).toBe(requestContext.traceId);
    expect(processed?.parentSpanContext?.spanId).toBe(producer?.spanContext().spanId);
    expect(received[0]?.attributes['traceparent']).toContain(requestContext.traceId);
    // O ciclo do relay é um trace próprio, ligado ao da requisição.
    expect(batch?.links.map((link) => link.context.traceId)).toEqual([requestContext.traceId]);
  });

  it('evento gravado fora de um trace não leva contexto e começa um trace novo no consumidor', async () => {
    await new KyselyOutboxWriter(db).append([
      {
        id: randomUUID(),
        aggregateType: 'catalog.product',
        aggregateId: randomUUID(),
        eventName: 'catalog.product-updates',
        eventVersion: 1,
        payload: { type: 'product.updated' },
        occurredAt: NOW,
      },
    ]);

    const row = await db.selectFrom('outbox_events').select('trace_context').executeTakeFirstOrThrow();
    expect(row.trace_context).toBeNull();
  });
});
