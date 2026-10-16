import type { RateLimitCounter, RateLimitHit } from '../../../presentation';
import type { RedisConnection } from './redis-connection';

/**
 * Janela fixa atômica: incrementa e, na primeira requisição da janela, define
 * a expiração. Tudo num único script, sem corrida entre réplicas.
 */
const HIT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('PTTL', KEYS[1])
  return { count, ttl }
`;

/**
 * Contador de rate limit no Redis: compartilhado entre todas as réplicas da
 * API e preservado entre reinícios.
 */
export class RedisRateLimitCounter implements RateLimitCounter {
  constructor(
    private readonly connection: RedisConnection,
    private readonly keyPrefix = 'fastmeals:rate-limit:',
  ) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const reply = await this.connection.evalScript(HIT_SCRIPT, [`${this.keyPrefix}${key}`], [windowMs]);

    if (!Array.isArray(reply) || typeof reply[0] !== 'number' || typeof reply[1] !== 'number') {
      throw new Error(`Resposta inesperada do Redis no rate limit: ${JSON.stringify(reply)}`);
    }
    // PTTL negativo (chave sem expiração) não deveria ocorrer; trata como janela inteira.
    return { count: reply[0], ttlMs: reply[1] >= 0 ? reply[1] : windowMs };
  }
}
