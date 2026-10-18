import { describe, expect, it } from 'vitest';

import { ReconnectBackoff } from '..';

describe('ReconnectBackoff', () => {
  const backoff = ReconnectBackoff.create({ baseMs: 1_000, maxMs: 30_000 });

  it.each([
    [0, 500, 1_000],
    [1, 1_000, 2_000],
    [2, 2_000, 4_000],
    [5, 15_000, 30_000],
    [10, 15_000, 30_000],
  ])('tentativa %i espera entre %i e %i ms', (attempt, min, max) => {
    expect(backoff.delayMs(attempt, 0)).toBe(min);
    expect(backoff.delayMs(attempt, 1)).toBe(max);
  });

  it('o sorteio espalha as reconexões (metade fixa, metade aleatória)', () => {
    expect(backoff.delayMs(1, 0.5)).toBe(1_500);
  });

  it('recusa configurações sem sentido', () => {
    expect(() => ReconnectBackoff.create({ baseMs: 0 })).toThrow(RangeError);
    expect(() => ReconnectBackoff.create({ baseMs: 5_000, maxMs: 1_000 })).toThrow(RangeError);
  });
});
