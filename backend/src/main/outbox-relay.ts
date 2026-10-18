/**
 * Worker do transactional outbox: lê as mensagens confirmadas pelos casos de
 * uso e as publica no tópico SNS de eventos. Cada fila assinante recebe sua
 * cópia (hoje, a do gateway de tempo real). Processo próprio, sem rotas da API; pode rodar em
 * várias réplicas (os lotes são disjuntos via `SKIP LOCKED`).
 *
 * Expõe só `GET /health` numa porta interna, para o orquestrador reiniciar um
 * worker travado.
 */
import Fastify from 'fastify';

import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { createSnsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { SnsMessagePublisher } from '../shared-kernel/infra/messaging/aws/sns-message.publisher';
import type { OutboxDatabase } from '../shared-kernel/infra/outbox/outbox-events.table';
import { OutboxRelay } from '../shared-kernel/infra/outbox/outbox-relay';
import { OutboxRelayRunner } from '../shared-kernel/infra/outbox/outbox-relay.runner';
import { awsClientConfig } from './config/messaging-env';
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
  const sns = createSnsClient(awsClientConfig(env));
  const publisher = new SnsMessagePublisher(sns, env.EVENTS_TOPIC_ARN);
  // Tópico errado ou inexistente é configuração: falha no boot, não mensagem a mensagem.
  await publisher.ping();
  const clock = new SystemClock();

  const relay = new OutboxRelay(db, publisher, clock, {
    maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    // Mensagem morta não chega ao painel: erro para alertar e investigar.
    onDeadLettered: (message) => log.error({ deadLetter: message }, 'Mensagem do outbox enviada para a fila morta'),
  });
  const runner = new OutboxRelayRunner(relay, {
    batchSize: env.OUTBOX_BATCH_SIZE,
    pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
    clock,
    onError: (error) => log.error({ err: error }, 'Falha no ciclo do outbox relay'),
  });

  health.get('/health', async (_request, reply) => {
    const [database, broker] = await Promise.all([
      check(() => pool.query('SELECT 1')),
      check(() => publisher.ping()),
    ]);
    const checks = { database, sns: broker, relay: runner.isAlive(MAX_CYCLE_STALENESS_MS) ? 'up' : 'down' };
    const healthy = Object.values(checks).every((state) => state === 'up');
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks });
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Encerrando o outbox relay');
    // Termina o lote em andamento antes de fechar as conexões.
    await runner.stop();
    await health.close();
    await pool.end();
    sns.destroy();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  runner.start();
  await health.listen({ host: env.RELAY_HEALTH_HOST, port: env.RELAY_HEALTH_PORT });
  log.info(
    { batchSize: env.OUTBOX_BATCH_SIZE, pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS, maxAttempts: env.OUTBOX_MAX_ATTEMPTS },
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
