/**
 * Consumidores de eventos dos contextos: cada um lê a **própria fila SQS**
 * assinada no tópico de eventos (com filtro e fila morta próprios) e reage
 * por um caso de uso. Hoje: o Ordering tira o entregador desativado ou
 * removido dos pedidos que ainda não saíram. Processo próprio, sem rotas da
 * API; várias réplicas dividem a fila (FIFO: a ordem por entregador vale).
 *
 * Expõe só `GET /health` numa porta interna, para o orquestrador reiniciar um
 * consumidor travado.
 */
import Fastify from 'fastify';

import { makeOrderingConsumers } from '../ordering/main/ordering-consumers';
import type { OrderingDatabase } from '../ordering/infra/persistence/schema/ordering-database';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { InMemoryEventMediator } from '../shared-kernel/infra/events/in-memory-event-mediator';
import { createSqsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { findQueue } from '../shared-kernel/infra/messaging/aws/messaging-topology';
import { SqsQueueConsumer } from '../shared-kernel/infra/messaging/aws/sqs-queue-consumer';
import { loadEventConsumersEnv } from './config/event-consumers-env';
import { awsClientConfig } from './config/messaging-env';

/** Sem ler a fila por este tempo (o long polling volta a cada 20 s), o consumidor está travado. */
const MAX_QUEUE_STALENESS_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 1_000;

async function main(): Promise<void> {
  const env = loadEventConsumersEnv();
  const health = Fastify({ logger: env.NODE_ENV !== 'test' });
  const log = health.log;

  const pool = createPostgresPool(env.DATABASE_URL);
  const db = createKysely<OrderingDatabase>(pool);
  const clock = new SystemClock();
  const ordering = makeOrderingConsumers({ db, clock, events: new InMemoryEventMediator() });

  const sqs = createSqsClient(awsClientConfig(env));
  // Fila inexistente é configuração: falha no boot (o `messaging-setup` a cria).
  const queue = await findQueue(sqs, env.ORDERING_QUEUE_NAME);
  const consumer = new SqsQueueConsumer(sqs, {
    queueUrl: queue.url,
    handle: async (message) => {
      const result = await ordering.deliveryPersonUpdates.handle(message.body);
      if (result.outcome === 'checked' && result.releasedOrderIds.length > 0) {
        log.info({ releasedOrderIds: result.releasedOrderIds }, 'Pedidos sem o entregador desativado voltaram para a atribuição');
      }
    },
    onError: (error, message) =>
      log.warn(
        { err: error },
        message === undefined
          ? 'Falha ao ler a fila do Ordering'
          : `Falha ao processar a mensagem ${message.id} (recebimento ${message.receiveCount}); volta à fila`,
      ),
    clock,
  });

  health.get('/health', async (_request, reply) => {
    const database = await check(() => pool.query('SELECT 1'));
    const checks = { database, queue: consumer.isAlive(MAX_QUEUE_STALENESS_MS) ? 'up' : 'down' };
    const healthy = Object.values(checks).every((state) => state === 'up');
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', checks });
  });

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Encerrando os consumidores de eventos');
    // Termina o lote em andamento; o que não foi processado volta sozinho à fila.
    await consumer.stop();
    await health.close();
    await pool.end();
    sqs.destroy();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  consumer.start();
  await health.listen({ host: env.EVENT_CONSUMERS_HEALTH_HOST, port: env.EVENT_CONSUMERS_HEALTH_PORT });
  log.info({ queue: env.ORDERING_QUEUE_NAME }, 'Consumidores de eventos iniciados');
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
