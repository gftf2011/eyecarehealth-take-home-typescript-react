/**
 * Worker do transactional outbox: lê as mensagens confirmadas pelos casos de
 * uso e as publica no Redis pub/sub, de onde o gateway de tempo real as
 * repassa aos painéis. Processo próprio, sem rotas da API; pode rodar em
 * várias réplicas (os lotes são disjuntos via `SKIP LOCKED`).
 *
 * Expõe só `GET /health` numa porta interna, para o orquestrador reiniciar um
 * worker travado.
 */
import Fastify from 'fastify';

import { RedisConnection } from '../shared-kernel/infra/cache/redis/redis-connection';
import { RedisMessagePublisher } from '../shared-kernel/infra/cache/redis/redis-message.publisher';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import type { OutboxDatabase } from '../shared-kernel/infra/outbox/outbox-events.table';
import { OutboxRelay } from '../shared-kernel/infra/outbox/outbox-relay';
import { OutboxRelayRunner } from '../shared-kernel/infra/outbox/outbox-relay.runner';
import { loadRelayEnv } from './config/relay-env';

/** Sem ciclo concluído por este tempo, o worker é considerado travado. */
const MAX_CYCLE_STALENESS_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 1_000;

async function main(): Promise<void> {
  const env = loadRelayEnv();
  const health = Fastify({ logger: env.NODE_ENV !== 'test' });
  const log = health.log;

  const pool = createPostgresPool(env.DATABASE_URL);
  const db = createKysely<OutboxDatabase>(pool);
  const redis = RedisConnection.open(env.REDIS_URL, {
    onError: (error) => log.warn({ err: error }, 'Redis indisponível'),
  });
  const clock = new SystemClock();

  const runner = new OutboxRelayRunner(new OutboxRelay(db, new RedisMessagePublisher(redis), clock), {
    batchSize: env.OUTBOX_BATCH_SIZE,
    pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
    clock,
    onError: (error) => log.error({ err: error }, 'Falha no ciclo do outbox relay'),
  });

  health.get('/health', async (_request, reply) => {
    const [database, cache] = await Promise.all([
      check(() => pool.query('SELECT 1')),
      check(() => redis.ping()),
    ]);
    const checks = { database, redis: cache, relay: runner.isAlive(MAX_CYCLE_STALENESS_MS) ? 'up' : 'down' };
    const healthy = Object.values(checks).every((state) => state === 'up');
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks });
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Encerrando o outbox relay');
    // Termina o lote em andamento antes de fechar as conexões.
    await runner.stop();
    await health.close();
    await Promise.all([pool.end(), redis.close()]);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  runner.start();
  await health.listen({ host: env.RELAY_HEALTH_HOST, port: env.RELAY_HEALTH_PORT });
  log.info(
    { batchSize: env.OUTBOX_BATCH_SIZE, pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS },
    'Outbox relay iniciado',
  );
}

async function check(probe: () => Promise<unknown>): Promise<'up' | 'down'> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), HEALTH_CHECK_TIMEOUT_MS);
      }),
    ]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
