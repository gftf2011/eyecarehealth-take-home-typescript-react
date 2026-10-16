import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

const base = { DATABASE_URL: 'postgresql://localhost/fastmeals' };

describe('loadEnv', () => {
  it('aplica os padrões do enunciado', () => {
    expect(loadEnv(base)).toMatchObject({
      PORT: 3001,
      RATE_LIMIT_MAX: 100,
      RATE_LIMIT_WINDOW_MS: 60_000,
      TRUST_PROXY: false,
    });
  });

  it('exige DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['1', 1],
    ['10.0.0.0/8, 172.16.0.0/12', ['10.0.0.0/8', '172.16.0.0/12']],
    ['', false],
  ])('TRUST_PROXY=%j → %j', (raw, expected) => {
    expect(loadEnv({ ...base, TRUST_PROXY: raw }).TRUST_PROXY).toEqual(expected);
  });

  it.each(['true', '*'])('recusa TRUST_PROXY=%s (confiar em qualquer proxy)', (raw) => {
    expect(() => loadEnv({ ...base, TRUST_PROXY: raw })).toThrow(/inseguro/);
  });
});
