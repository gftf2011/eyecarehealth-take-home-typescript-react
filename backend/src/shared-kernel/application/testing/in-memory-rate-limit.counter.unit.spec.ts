import { describe, expect, it } from 'vitest';

import { InMemoryRateLimitCounter } from './in-memory-rate-limit.counter';

describe('InMemoryRateLimitCounter', () => {
  it('conta por chave dentro da janela e informa o tempo restante', async () => {
    let now = 1_000;
    const counter = new InMemoryRateLimitCounter(() => now);

    const first = await counter.hit('a', 60_000);
    now += 10_000;
    const second = await counter.hit('a', 60_000);
    const other = await counter.hit('b', 60_000);

    expect([first.count, second.count, other.count]).toEqual([1, 2, 1]);
    expect(second.ttlMs).toBe(50_000);
  });

  it('peek lê a contagem sem incrementar', async () => {
    let now = 0;
    const counter = new InMemoryRateLimitCounter(() => now);

    expect(await counter.peek('a')).toEqual({ count: 0, ttlMs: 0 });
    await counter.hit('a', 1_000);
    now = 400;

    expect(await counter.peek('a')).toEqual({ count: 1, ttlMs: 600 });
    expect(await counter.peek('a')).toEqual({ count: 1, ttlMs: 600 });
    now = 1_000;
    expect(await counter.peek('a')).toEqual({ count: 0, ttlMs: 0 });
  });

  it('recomeça quando a janela expira', async () => {
    let now = 0;
    const counter = new InMemoryRateLimitCounter(() => now);

    await counter.hit('a', 1_000);
    await counter.hit('a', 1_000);
    now = 1_000;

    expect((await counter.hit('a', 1_000)).count).toBe(1);
  });
});
