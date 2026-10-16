import { describe, expect, it } from 'vitest';

import { parseDurationMs } from './duration';
import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://localhost/fastmeals',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('loadEnv', () => {
  it('aplica os padrões do enunciado', () => {
    expect(loadEnv(base)).toMatchObject({
      PORT: 3001,
      RATE_LIMIT_MAX: 100,
      RATE_LIMIT_WINDOW_MS: 60_000,
      TRUST_PROXY: false,
      JWT_EXPIRES_IN: 15 * 60_000,
      JWT_REFRESH_EXPIRES_IN: 7 * 24 * 60 * 60_000,
      BCRYPT_COST: 10,
      LOGIN_MAX_ATTEMPTS: 5,
    });
  });

  it.each([
    [{}, /DATABASE_URL/],
    [{ ...base, REDIS_URL: undefined }, /REDIS_URL/],
    [{ ...base, JWT_SECRET: 'curto' }, /32 caracteres/],
    [{ ...base, JWT_REFRESH_SECRET: base.JWT_SECRET }, /segredos diferentes/],
    [{ ...base, JWT_EXPIRES_IN: '15 minutos' }, /JWT_EXPIRES_IN/],
    [{ ...base, BCRYPT_COST: '9' }, /BCRYPT_COST/],
  ])('recusa configuração inválida %#', (source, message) => {
    expect(() => loadEnv(source)).toThrow(message);
  });

  it.each([
    ['production', undefined, true],
    ['development', undefined, false],
    ['development', 'true', true],
    ['production', 'false', false],
  ] as const)('NODE_ENV=%s COOKIE_SECURE=%s → cookie Secure %s', (nodeEnv, cookieSecure, expected) => {
    const env = loadEnv({
      ...base,
      NODE_ENV: nodeEnv,
      ...(cookieSecure !== undefined && { COOKIE_SECURE: cookieSecure }),
    });
    expect(env.COOKIE_SECURE).toBe(expected);
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

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
    ['7d', 604_800_000],
    ['500', 500],
    ['250ms', 250],
    ['7 dias', null],
    ['', null],
  ])('%j → %j', (raw, expected) => {
    expect(parseDurationMs(raw)).toBe(expected);
  });
});
