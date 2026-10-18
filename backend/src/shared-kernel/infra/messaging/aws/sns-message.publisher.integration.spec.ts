import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { describe, expect, it } from 'vitest';

import { BrokerUnavailableError, type PublishedMessage } from '../../../application';
import { createSnsClient } from './aws-clients';
import { SnsMessagePublisher } from './sns-message.publisher';
import { createTestMessaging, testAwsConfig, type TestMessaging } from './testing/test-aws';

function message(topic: string, payload: PublishedMessage['payload'] = { type: 'order.placed' }): PublishedMessage {
  return {
    id: crypto.randomUUID(),
    topic,
    version: 1,
    aggregateType: 'ordering.order',
    aggregateId: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
    payload,
    occurredAt: new Date('2025-01-20T12:00:00Z'),
  };
}

async function receiveAll(messaging: TestMessaging): Promise<string[]> {
  const { Messages = [] } = await messaging.sqs.send(
    new ReceiveMessageCommand({ QueueUrl: messaging.queue.url, MaxNumberOfMessages: 10, WaitTimeSeconds: 2 }),
  );
  return Messages.map((received) => received.Body ?? '');
}

describe('SnsMessagePublisher (Floci)', () => {
  it('a fila assinante recebe o envelope cru, só dos tópicos do filtro', async () => {
    const messaging = await createTestMessaging({ topics: ['ordering.order-updates'] });
    const publisher = new SnsMessagePublisher(messaging.sns, messaging.topicArn);
    const order = message('ordering.order-updates');

    await publisher.publish(order);
    await publisher.publish(message('outro.contexto'));

    const bodies = await receiveAll(messaging);
    expect(bodies.map((body) => JSON.parse(body) as { id: string })).toEqual([
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

  it('mensagem recusada pelo SNS é erro da mensagem (permanente)', async () => {
    const messaging = await createTestMessaging();
    const publisher = new SnsMessagePublisher(messaging.sns, messaging.topicArn);

    const tooLarge = publisher.publish(message('ordering.order-updates', { blob: 'x'.repeat(300_000) }));

    await expect(tooLarge).rejects.toMatchObject({ name: 'InvalidParameterException' });
    await expect(tooLarge).rejects.not.toBeInstanceOf(BrokerUnavailableError);
  });

  it('SNS inalcançável é queda do broker (transitória)', async () => {
    const sns = createSnsClient({ ...testAwsConfig(), endpoint: 'http://127.0.0.1:1' });
    const publisher = new SnsMessagePublisher(sns, 'arn:aws:sns:us-east-1:000000000000:qualquer');

    await expect(publisher.publish(message('ordering.order-updates'))).rejects.toBeInstanceOf(BrokerUnavailableError);
    sns.destroy();
  });

  it('ping falha se o tópico não existir', async () => {
    const messaging = await createTestMessaging();

    await expect(new SnsMessagePublisher(messaging.sns, messaging.topicArn).ping()).resolves.toBeUndefined();
    await expect(new SnsMessagePublisher(messaging.sns, `${messaging.topicArn}-inexistente`).ping()).rejects.toThrow();
  });
});
