import { makeCatalogRoutes } from '../catalog/main/catalog.module';
import type { CatalogDatabase } from '../catalog/infra/persistence/schema/catalog-database';
import { makeDeliveryRoutes } from '../delivery/main/delivery.module';
import type { DeliveryDatabase } from '../delivery/infra/persistence/schema/delivery-database';
import { makeIdentityModule } from '../identity/main/identity.module';
import type { IdentityDatabase } from '../identity/infra/persistence/schema/identity-database';
import { makeOrderingRoutes } from '../ordering/main/ordering.module';
import type { OrderingDatabase } from '../ordering/infra/persistence/schema/ordering-database';
import { makeReportingRoutes } from '../reporting/main/reporting.module';
import type { ReportingDatabase } from '../reporting/infra/persistence/schema/reporting-database';
import { RedisConnection } from '../shared-kernel/infra/cache/redis/redis-connection';
import { RedisRateLimitCounter } from '../shared-kernel/infra/cache/redis/redis-rate-limit.counter';
import { PerformanceStopwatch } from '../shared-kernel/infra/clock/performance-stopwatch';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { InMemoryEventMediator } from '../shared-kernel/infra/events/in-memory-event-mediator';
import { loadEnv } from './config/env';
import { buildApp } from './http/app';

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env.DATABASE_URL);
  const clock = new SystemClock();
  // Mediador único da aplicação: cada módulo publica nele e inscreve os
  // próprios handlers (reação a outros contextos ou aviso a sistemas externos).
  const events = new InMemoryEventMediator();

  // O logger do Fastify só existe depois do app: até lá, erros do Redis vão ao console.
  let logRedisError = (error: Error): void => console.warn('Redis indisponível', error.message);
  const redis = RedisConnection.open(env.REDIS_URL, { onError: (error) => logRedisError(error) });

  const catalogDb = createKysely<CatalogDatabase>(pool);
  const identityDb = createKysely<IdentityDatabase>(pool);
  const orderingDb = createKysely<OrderingDatabase>(pool);
  const deliveryDb = createKysely<DeliveryDatabase>(pool);
  const reportingDb = createKysely<ReportingDatabase>(pool);

  const identity = makeIdentityModule({
    db: identityDb,
    clock,
    events,
    secrets: { accessToken: env.JWT_SECRET, refreshToken: env.JWT_REFRESH_SECRET },
    policy: {
      accessTokenTtlMs: env.JWT_EXPIRES_IN,
      refreshTokenTtlMs: env.JWT_REFRESH_EXPIRES_IN,
      loginAttempts: { max: env.LOGIN_MAX_ATTEMPTS, windowMs: env.LOGIN_WINDOW_MS },
    },
    bcryptCost: env.BCRYPT_COST,
    secureCookies: env.COOKIE_SECURE,
    loginAttempts: new RedisRateLimitCounter(redis, 'fastmeals:login-failures:'),
  });

  const app = await buildApp({
    routes: [
      ...identity.routes,
      ...makeCatalogRoutes({ db: catalogDb, clock, events }),
      ...makeOrderingRoutes({ db: orderingDb, clock, events }),
      ...makeDeliveryRoutes({ db: deliveryDb, clock, events, stopwatch: new PerformanceStopwatch() }),
      ...makeReportingRoutes({ db: reportingDb }),
    ],
    authenticator: identity.authenticator,
    healthChecks: {
      // Um pool para todos os contextos: verificar o banco é verificar o pool,
      // sem passar pelo Kysely de nenhum contexto em particular.
      database: async () => {
        await pool.query('SELECT 1');
      },
      redis: () => redis.ping(),
    },
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      timeWindowMs: env.RATE_LIMIT_WINDOW_MS,
      counter: new RedisRateLimitCounter(redis, 'fastmeals:rate-limit:'),
    },
    trustProxy: env.TRUST_PROXY,
    logger: env.NODE_ENV !== 'test',
  });

  logRedisError = (error) => app.log.warn({ err: error }, 'Redis indisponível');
  if (!env.COOKIE_SECURE) {
    app.log.warn('COOKIE_SECURE=false: cookie de sessão sem Secure (apenas desenvolvimento)');
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando');
    await app.close();
    await Promise.all([pool.end(), redis.close()]);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
