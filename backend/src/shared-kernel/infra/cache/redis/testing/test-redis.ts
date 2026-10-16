import { randomUUID } from 'node:crypto';

import { inject } from 'vitest';

import { RedisConnection } from '../redis-connection';
import { RedisRateLimitCounter } from '../redis-rate-limit.counter';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL do Redis de teste (ver containers-global-setup). */
    redisUrl: string;
  }
}

/** Conexão pronta com o Redis de teste. */
export async function connectToTestRedis(): Promise<RedisConnection> {
  const connection = RedisConnection.open(inject('redisUrl'), { onError: () => undefined });
  await connection.ready();
  return connection;
}

/**
 * Contador Redis com prefixo único: cada teste/app conta isolado, sem
 * precisar limpar o Redis compartilhado.
 */
export function isolatedRedisCounter(connection: RedisConnection, label: string): RedisRateLimitCounter {
  return new RedisRateLimitCounter(connection, `test:${label}:${randomUUID()}:`);
}
