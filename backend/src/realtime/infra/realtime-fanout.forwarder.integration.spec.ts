import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import type { RedisConnection } from '../../shared-kernel/infra/cache/redis/redis-connection';
import { RedisSubscription } from '../../shared-kernel/infra/cache/redis/redis-subscription';
import { connectToTestRedis } from '../../shared-kernel/infra/cache/redis/testing/test-redis';
import { InvalidEnvelopeError, RealtimeFanoutForwarder } from './realtime-fanout.forwarder';

const prefix = `test:${randomUUID()}:`;
const envelope = JSON.stringify({
  id: 'e1',
  topic: 'catalog.product-updates',
  version: 1,
  aggregateId: 'p1',
  occurredAt: '2025-01-20T12:00:00.000Z',
  payload: { type: 'product.updated', productId: 'p1' },
});

describe('RealtimeFanoutForwarder (Redis)', () => {
  let redis: RedisConnection;
  let subscription: RedisSubscription;
  const received: [string, string][] = [];

  beforeAll(async () => {
    redis = await connectToTestRedis();
    subscription = await RedisSubscription.open(inject('redisUrl'), [`${prefix}catalog.product-updates`], {
      onMessage: (channel, body) => received.push([channel, body]),
      onError: () => undefined,
    });
  });

  afterAll(async () => {
    await subscription.close();
    await redis.close();
  });

  it('repassa o envelope ao canal do tópico, sem alterá-lo', async () => {
    await new RealtimeFanoutForwarder(redis, prefix).forward(envelope);

    await expect.poll(() => received).toEqual([[`${prefix}catalog.product-updates`, envelope]]);
  });

  it('envelope inválido é recusado (vai para a fila morta), sem publicar', async () => {
    const before = received.length;

    await expect(new RealtimeFanoutForwarder(redis, prefix).forward('{"oi":1}')).rejects.toBeInstanceOf(
      InvalidEnvelopeError,
    );
    expect(received).toHaveLength(before);
  });
});
