/**
 * Gateway de tempo real: consome a fila SQS do tempo real (assinada no tópico
 * SNS onde o outbox relay publica), espalha cada evento pelo Redis pub/sub
 * entre as réplicas e repassa as atualizações de pedidos e do cardápio aos
 * painéis por WebSocket.
 *
 * Processo próprio: conexões longas ficam isoladas da API e um deploy da API
 * não derruba os painéis. Pode rodar em várias réplicas: a fila entrega cada
 * mensagem a uma delas, e o Redis a leva a todas.
 */
import { PRODUCT_UPDATES_TOPIC } from '../catalog/application/messages/product-update.message';
import { DELIVERY_PERSON_UPDATES_TOPIC } from '../delivery/application/messages/delivery-person-update.message';
import { makeTokenAuthenticator } from '../identity/main/token-authenticator.factory';
import { ORDER_UPDATES_TOPIC } from '../ordering/application/messages/order-update.message';
import { RealtimeHub } from '../realtime/application/realtime-hub';
import { toRealtimeEvent } from '../realtime/infra/broker-envelope';
import { RealtimeFanoutForwarder } from '../realtime/infra/realtime-fanout.forwarder';
import { buildRealtimeApp } from '../realtime/presentation/realtime-app';
import { channelOf } from '../shared-kernel/infra/cache/redis/redis-channel';
import { RedisConnection } from '../shared-kernel/infra/cache/redis/redis-connection';
import { RedisSubscription } from '../shared-kernel/infra/cache/redis/redis-subscription';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { meter } from '../shared-kernel/infra/observability/telemetry';
import { createSqsClient } from '../shared-kernel/infra/messaging/aws/aws-clients';
import { findQueue } from '../shared-kernel/infra/messaging/aws/messaging-topology';
import { SqsQueueConsumer } from '../shared-kernel/infra/messaging/aws/sqs-queue-consumer';
import { awsClientConfig } from './config/messaging-env';
import { loadRealtimeEnv } from './config/realtime-env';

/** Long polling de 20 s: sem leitura bem-sucedida por 60 s, o consumidor travou. */
const MAX_QUEUE_STALENESS_MS = 60_000;

async function main(): Promise<void> {
  const env = loadRealtimeEnv();
  const clock = new SystemClock();
  const hub = new RealtimeHub();

  // O logger do Fastify só existe depois do app: até lá, avisos vão ao console.
  let warn = (message: string, error?: unknown): void => console.warn(message, error);
  // Tópicos públicos que o painel acompanha: pedidos, cardápio e entregadores.
  const topics = [ORDER_UPDATES_TOPIC, PRODUCT_UPDATES_TOPIC, DELIVERY_PERSON_UPDATES_TOPIC];
  const subscription = await RedisSubscription.open(env.REDIS_URL, topics.map((topic) => channelOf(topic)), {
    connectionName: 'fastmeals-realtime-gateway',
    onMessage: (_channel, body) => {
      const event = toRealtimeEvent(body);
      if (event === null) warn('Mensagem do broker fora do envelope: descartada');
      else hub.broadcast(event);
    },
    onError: (error) => warn('Redis indisponível', error),
  });
  // Conexão própria para publicar: a de assinatura não aceita outros comandos.
  const redis = RedisConnection.open(env.REDIS_URL, { onError: (error) => warn('Redis indisponível', error) });

  const sqs = createSqsClient(awsClientConfig(env));
  const queue = await findQueue(sqs, env.REALTIME_QUEUE_NAME);
  const forwarder = new RealtimeFanoutForwarder(redis);
  const consumer = new SqsQueueConsumer(sqs, {
    queueUrl: queue.url,
    handle: (message) => forwarder.forward(message.body),
    onError: (error, message) =>
      warn(
        message === undefined
          ? 'Falha ao ler a fila do tempo real'
          : `Falha ao repassar a mensagem ${message.id} (recebimento ${message.receiveCount}); volta à fila`,
        error,
      ),
    clock,
  });

  // Conexões abertas e autenticadas nesta réplica, lidas a cada exportação.
  meter()
    .createObservableGauge('fastmeals.realtime.connections', {
      description: 'Conexões WebSocket desta réplica do gateway, por estado',
      unit: '{connection}',
    })
    .addCallback((result) => {
      result.observe(hub.connectionCount, { state: 'open' });
      result.observe(hub.authenticatedCount, { state: 'authenticated' });
    });

  const app = await buildRealtimeApp({
    hub,
    authenticator: makeTokenAuthenticator(env.JWT_SECRET, clock),
    clock,
    // Quem acompanha os pedidos (painel) ou as próprias entregas (entregador). As mensagens
    // só levam ids e status, nunca dados pessoais: os detalhes vêm pela API, que confere o dono.
    requiredPermissions: ['orders:read', 'my-deliveries:read'],
    allowedOrigins: env.REALTIME_ALLOWED_ORIGINS,
    healthChecks: {
      redis: () => subscription.isReady && redis.isReady,
      queue: () => consumer.isAlive(MAX_QUEUE_STALENESS_MS),
    },
    logger: env.NODE_ENV !== 'test',
  });
  warn = (message, error) => app.log.warn({ err: error }, message);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando o gateway de tempo real');
    // Para de tirar mensagens da fila; as que não foram repassadas voltam sozinhas.
    await consumer.stop();
    // Fecha as conexões com 1012 (clientes reconectam) antes de soltar o Redis.
    await app.close();
    await Promise.all([subscription.close(), redis.close()]);
    sqs.destroy();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  consumer.start();
  await app.listen({ host: env.REALTIME_HOST, port: env.REALTIME_PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
