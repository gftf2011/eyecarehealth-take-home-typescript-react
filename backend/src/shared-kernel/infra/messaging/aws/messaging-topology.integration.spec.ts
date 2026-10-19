import { randomUUID } from 'node:crypto';

import { ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { describe, expect, it } from 'vitest';

import { createSnsClient, createSqsClient } from './aws-clients';
import { ensureMessagingTopology, findQueue } from './messaging-topology';
import { testAwsConfig } from './testing/test-aws';

describe('ensureMessagingTopology (Floci)', () => {
  const sns = createSnsClient(testAwsConfig());
  const sqs = createSqsClient(testAwsConfig());
  const suffix = randomUUID().slice(0, 8);
  const spec = {
    topicName: `topology-events-${suffix}.fifo`,
    queueName: `topology-queue-${suffix}.fifo`,
    deadLetterQueueName: `topology-dlq-${suffix}.fifo`,
    maxReceiveCount: 5,
    visibilityTimeoutSeconds: 30,
    topics: ['ordering.order-updates'],
  };

  it('cria tópico, fila com redrive para a fila morta e uma única assinatura, mesmo rodando duas vezes', async () => {
    const first = await ensureMessagingTopology(sns, sqs, spec);
    const second = await ensureMessagingTopology(sns, sqs, spec);

    expect(second).toEqual(first);
    const { Subscriptions = [] } = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: first.topicArn }));
    expect(Subscriptions.map((subscription) => subscription.Endpoint)).toEqual([first.queue.arn]);

    const { Attributes = {} } = await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: first.queue.url, AttributeNames: ['All'] }),
    );
    expect(Attributes['VisibilityTimeout']).toBe('30');
    expect(Attributes['FifoQueue']).toBe('true');
    expect(Attributes['DeduplicationScope']).toBe('messageGroup');
    expect(Attributes['FifoThroughputLimit']).toBe('perMessageGroupId');
    expect(JSON.parse(Attributes['RedrivePolicy'] ?? '{}')).toEqual({
      deadLetterTargetArn: first.deadLetterQueue.arn,
      maxReceiveCount: 5,
    });
  });

  it('recusa nomes que não são FIFO, antes de criar qualquer coisa', async () => {
    await expect(ensureMessagingTopology(sns, sqs, { ...spec, queueName: `padrao-${suffix}` })).rejects.toThrow(
      /precisam ser FIFO/,
    );
  });

  it('findQueue resolve URL e ARN pelo nome, e falha se a fila não existir', async () => {
    const topology = await ensureMessagingTopology(sns, sqs, spec);

    expect(await findQueue(sqs, spec.queueName)).toEqual(topology.queue);
    await expect(findQueue(sqs, `nao-existe-${suffix}.fifo`)).rejects.toThrow(/./);
  });
});
