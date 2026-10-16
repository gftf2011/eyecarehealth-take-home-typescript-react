import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisConnection } from './redis-connection';
import { RedisRateLimitCounter } from './redis-rate-limit.counter';

describe('RedisRateLimitCounter', () => {
  let container: StartedRedisContainer;
  let connection: RedisConnection;
  let counter: RedisRateLimitCounter;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();
    connection = RedisConnection.open(container.getConnectionUrl(), { onError: () => undefined });
    await connection.ready();
    // Prefixo único: cada execução começa com contadores zerados.
    counter = new RedisRateLimitCounter(connection, `test:${randomUUID()}:`);
  });

  afterAll(async () => {
    await connection.close();
    await container.stop();
  });

  it('conta as requisições da mesma chave dentro da janela', async () => {
    const hits = [];
    for (let attempt = 0; attempt < 3; attempt += 1) hits.push(await counter.hit('ip-a', 60_000));

    expect(hits.map((hit) => hit.count)).toEqual([1, 2, 3]);
    expect(hits[0]?.ttlMs).toBeGreaterThan(59_000);
    expect(hits[2]?.ttlMs).toBeLessThanOrEqual(hits[0]?.ttlMs ?? 0);
  });

  it('mantém chaves independentes', async () => {
    await counter.hit('ip-b', 60_000);
    expect((await counter.hit('ip-c', 60_000)).count).toBe(1);
  });

  it('é atômico sob concorrência', async () => {
    const hits = await Promise.all(Array.from({ length: 50 }, () => counter.hit('ip-burst', 60_000)));

    expect(hits.map((hit) => hit.count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
  });

  it('recomeça a contagem quando a janela expira', async () => {
    await counter.hit('ip-window', 150);
    await counter.hit('ip-window', 150);

    await sleep(250);

    expect((await counter.hit('ip-window', 150)).count).toBe(1);
  });
});
