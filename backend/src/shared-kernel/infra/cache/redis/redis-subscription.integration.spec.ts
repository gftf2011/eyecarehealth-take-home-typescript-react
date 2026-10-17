import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import type { RedisConnection } from './redis-connection';
import { RedisSubscription } from './redis-subscription';
import { connectToTestRedis } from './testing/test-redis';

describe('RedisSubscription', () => {
  let publisher: RedisConnection;

  beforeAll(async () => {
    publisher = await connectToTestRedis();
  });

  afterAll(async () => {
    await publisher.close();
  });

  it('recebe as mensagens publicadas nos canais assinados', async () => {
    const channel = `test:${randomUUID()}`;
    const received: [string, string][] = [];
    const subscription = await RedisSubscription.open(inject('redisUrl'), [channel], {
      onMessage: (from, body) => received.push([from, body]),
      onError: () => undefined,
    });

    await publisher.publish(channel, 'olá');
    await publisher.publish(`${channel}:outro`, 'ignorada');

    await expect.poll(() => received).toEqual([[channel, 'olá']]);
    expect(subscription.isReady).toBe(true);
    await subscription.close();
  });

  it('depois de perder a conexão, reconecta e se reinscreve sozinha', async () => {
    const channel = `test:${randomUUID()}`;
    const connectionName = `test-subscription-${randomUUID()}`;
    const received: string[] = [];
    const subscription = await RedisSubscription.open(inject('redisUrl'), [channel], {
      connectionName,
      onMessage: (_from, body) => received.push(body),
      onError: () => undefined,
    });

    // Derruba só esta conexão (o Redis de teste é compartilhado), como numa queda de rede.
    const admin = new Redis(inject('redisUrl'));
    const clients = String(await admin.call('CLIENT', 'LIST', 'TYPE', 'pubsub'));
    const id = clients
      .split('\n')
      .find((line) => line.includes(`name=${connectionName}`))
      ?.match(/\bid=(\d+)/)?.[1];
    expect(id).toBeDefined();
    await admin.call('CLIENT', 'KILL', 'ID', id ?? '');
    await admin.quit();

    // Publica até a reinscrição concluir (o intervalo sem assinatura perde mensagens).
    await expect
      .poll(async () => {
        await publisher.publish(channel, 'depois da queda');
        return received.includes('depois da queda');
      }, { timeout: 10_000, interval: 200 })
      .toBe(true);
    await subscription.close();
  });
});
