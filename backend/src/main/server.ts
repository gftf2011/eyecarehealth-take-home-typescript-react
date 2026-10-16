import { sql } from 'kysely';

import { makeCatalogRoutes } from '../catalog/main/catalog.module';
import type { CatalogDatabase } from '../catalog/infra/persistence/schema/catalog-database';
import { RedisConnection } from '../shared-kernel/infra/cache/redis/redis-connection';
import { RedisRateLimitCounter } from '../shared-kernel/infra/cache/redis/redis-rate-limit.counter';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { PendingIdentityAuthenticator } from './auth/pending-identity.authenticator';
import { loadEnv } from './config/env';
import { buildApp, type HealthChecks } from './http/app';

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env.DATABASE_URL);
  const clock = new SystemClock();

  // O logger do Fastify só existe depois do app: até lá, erros do Redis vão ao console.
  let logRedisError = (error: Error): void => console.warn('Redis indisponível', error.message);
  const redis =
    env.REDIS_URL === undefined
      ? undefined
      : RedisConnection.open(env.REDIS_URL, { onError: (error) => logRedisError(error) });

  const catalogDb = createKysely<CatalogDatabase>(pool);

  const healthChecks: HealthChecks = {
    database: async () => {
      await sql`SELECT 1`.execute(catalogDb);
    },
    ...(redis !== undefined && { redis: () => redis.ping() }),
  };

  const app = await buildApp({
    routes: [...makeCatalogRoutes({ db: catalogDb, clock })],
    authenticator: new PendingIdentityAuthenticator(),
    healthChecks,
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      timeWindowMs: env.RATE_LIMIT_WINDOW_MS,
      ...(redis !== undefined && { counter: new RedisRateLimitCounter(redis) }),
    },
    trustProxy: env.TRUST_PROXY,
    logger: env.NODE_ENV !== 'test',
  });

  logRedisError = (error) => app.log.warn({ err: error }, 'Redis indisponível');
  if (redis === undefined) {
    app.log.warn('REDIS_URL ausente: rate limit em memória (não compartilhado entre réplicas)');
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando');
    await app.close();
    await Promise.all([pool.end(), redis?.close()]);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
