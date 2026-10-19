import { DeleteMessageBatchCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { describe, expect, it } from 'vitest';

import type { PublishedMessage } from '../../../application';
import { createSnsClient } from './aws-clients';
import { SnsMessagePublisher } from './sns-message.publisher';
import { createTestMessaging, testAwsConfig, type TestMessaging } from './testing/test-aws';

function message(
  topic: string,
  payload: PublishedMessage['payload'] = { type: 'order.placed' },
  aggregateId: string = crypto.randomUUID(),
): PublishedMessage {
  return {
    id: crypto.randomUUID(),
    topic,
    version: 1,
    aggregateType: 'ordering.order',
    aggregateId,
    payload,
    occurredAt: new Date('2025-01-20T12:00:00Z'),
  };
}

/**
 * Lê (e apaga) a fila até ela parar de devolver mensagens. Na FIFO, o grupo
 * só libera as próximas depois que as anteriores são apagadas.
 */
async function drain(messaging: TestMessaging): Promise<string[]> {
  const bodies: string[] = [];
  for (;;) {
    const { Messages = [] } = await messaging.sqs.send(
      new ReceiveMessageCommand({ QueueUrl: messaging.queue.url, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }),
    );
    if (Messages.length === 0) return bodies;
    bodies.push(...Messages.map((received) => received.Body ?? ''));
    await messaging.sqs.send(
      new DeleteMessageBatchCommand({
        QueueUrl: messaging.queue.url,
        Entries: Messages.map((received, index) => ({ Id: String(index), ReceiptHandle: received.ReceiptHandle ?? '' })),
      }),
    );
  }
}

describe('SnsMessagePublisher (Floci)', () => {
  it('a fila assinante recebe o envelope cru, só dos tópicos do filtro', async () => {
    const messaging = await createTestMessaging({ topics: ['ordering.order-updates'], visibilityTimeoutSeconds: 30 });
    const publisher = new SnsMessagePublisher(messaging.sns, messaging.topicArn);
    const order = message('ordering.order-updates');

    const outcomes = await publisher.publishBatch([order, message('outro.contexto')]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['published', 'published']);
    expect((await drain(messaging)).map((body) => JSON.parse(body) as { id: string })).toEqual([
      {
        id: order.id,
        topic: 'ordering.order-updates',
        version: 1,
        aggregateId: order.aggregateId,
        occurredAt: '2025-01-20T12:00:00.000Z',
        payload: { type: 'order.placed' },
      },
    ]);
  });

  it('lote de 25 mensagens (3 chamadas PublishBatch) chega inteiro à fila', async () => {
    const messaging = await createTestMessaging({ visibilityTimeoutSeconds: 30 });
    const messages = Array.from({ length: 25 }, () => message('ordering.order-updates'));

    const outcomes = await new SnsMessagePublisher(messaging.sns, messaging.topicArn).publishBatch(messages);

    expect(outcomes.every((outcome) => outcome.status === 'published')).toBe(true);
    const received = (await drain(messaging)).map((body) => (JSON.parse(body) as { id: string }).id);
    expect(new Set(received)).toEqual(new Set(messages.map((m) => m.id)));
  });

  it('FIFO: publicar duas vezes (o relay repete após um commit que falhou) entrega uma só', async () => {
    const messaging = await createTestMessaging({ visibilityTimeoutSeconds: 30 });
    const publisher = new SnsMessagePublisher(messaging.sns, messaging.topicArn);
    const once = message('ordering.order-updates');

    await publisher.publishBatch([once]);
    await publisher.publishBatch([once]);

    expect((await drain(messaging)).map((body) => (JSON.parse(body) as { id: string }).id)).toEqual([once.id]);
  });

  it('FIFO: as mensagens de um pedido chegam na ordem em que foram publicadas', async () => {
    const messaging = await createTestMessaging({ visibilityTimeoutSeconds: 30 });
    const order = crypto.randomUUID();
    const messages = Array.from({ length: 12 }, (_, n) => message('ordering.order-updates', { n }, order));

    await new SnsMessagePublisher(messaging.sns, messaging.topicArn).publishBatch(messages);

    const received = (await drain(messaging)).map((body) => (JSON.parse(body) as { payload: { n: number } }).payload.n);
    expect(received).toEqual(messages.map((_, n) => n));
  });

  it('mensagens grandes são divididas pelo limite de bytes e todas saem', async () => {
    const messaging = await createTestMessaging({ visibilityTimeoutSeconds: 30 });
    const big = Array.from({ length: 3 }, () => message('ordering.order-updates', { blob: 'x'.repeat(100 * 1024) }));

    const outcomes = await new SnsMessagePublisher(messaging.sns, messaging.topicArn).publishBatch(big);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['published', 'published', 'published']);
  });

  it('SNS inalcançável: todas ficam como falha transitória', async () => {
    const sns = createSnsClient({ ...testAwsConfig(), endpoint: 'http://127.0.0.1:1' });
    const publisher = new SnsMessagePublisher(sns, 'arn:aws:sns:us-east-1:000000000000:qualquer');

    // Pedidos diferentes: nenhuma fica adiada atrás da outra.
    const outcomes = await publisher.publishBatch([message('ordering.order-updates'), message('ordering.order-updates')]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['broker-unavailable', 'broker-unavailable']);
    sns.destroy();
  });

  it('ping falha se o tópico não existir', async () => {
    const messaging = await createTestMessaging();

    await expect(new SnsMessagePublisher(messaging.sns, messaging.topicArn).ping()).resolves.toBeUndefined();
    await expect(new SnsMessagePublisher(messaging.sns, `${messaging.topicArn}-inexistente`).ping()).rejects.toThrow(/./);
  });
});
