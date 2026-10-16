import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RedisConnection } from './redis-connection';
import type { RedisRateLimitCounter } from './redis-rate-limit.counter';
import { connectToTestRedis, isolatedRedisCounter } from './testing/test-redis';

describe('RedisRateLimitCounter', () => {
  let connection: RedisConnection;
  let counter: RedisRateLimitCounter;

  beforeAll(async () => {
    connection = await connectToTestRedis();
    // Prefixo único: cada execução começa com contadores zerados.
    counter = isolatedRedisCounter(connection, 'counter-spec');
  });

  afterAll(async () => {
    await connection.close();
  });

  it('conta as requisições da mesma chave dentro da janela', async () => {
    const hits = [];
    for (let attempt = 0; attempt < 3; attempt += 1) hits.push(await counter.hit('ip-a', 60_000));

    expect(hits.map((hit) => hit.count)).toEqual([1, 2, 3]);
    expect(hits[0]?.ttlMs).toBeGreaterThan(59_000);
    expect(hits[2]?.ttlMs).toBeLessThanOrEqual(hits[0]?.ttlMs ?? 0);
  });

  it('peek lê a contagem e o tempo restante sem incrementar', async () => {
    expect(await counter.peek('ip-peek')).toEqual({ count: 0, ttlMs: 0 });

    await counter.hit('ip-peek', 60_000);
    const first = await counter.peek('ip-peek');
    const second = await counter.peek('ip-peek');

    expect([first.count, second.count]).toEqual([1, 1]);
    expect(first.ttlMs).toBeGreaterThan(59_000);
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
