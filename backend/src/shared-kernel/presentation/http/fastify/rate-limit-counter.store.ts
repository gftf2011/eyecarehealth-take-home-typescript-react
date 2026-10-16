import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from '@fastify/rate-limit';

import type { RateLimitCounter } from '../../rate-limit/rate-limit-counter';

/**
 * Adapter port → plugin: transforma um `RateLimitCounter` no "store" que o
 * `@fastify/rate-limit` instancia. O plugin não sabe de onde vêm os números.
 */
export function toRateLimitStore(counter: RateLimitCounter): FastifyRateLimitStoreCtor {
  return class RateLimitCounterStore implements FastifyRateLimitStore {
    incr(
      key: string,
      callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
      timeWindow: number,
    ): void {
      counter.hit(key, timeWindow).then(
        (hit) => callback(null, { current: hit.count, ttl: hit.ttlMs }),
        (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
      );
    }

    /** Mesma janela e mesmo contador para todas as rotas. */
    child(): FastifyRateLimitStore {
      return this;
    }
  };
}
