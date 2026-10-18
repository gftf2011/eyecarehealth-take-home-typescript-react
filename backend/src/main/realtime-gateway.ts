/**
 * Gateway de tempo real: assina o Redis pub/sub (alimentado pelo outbox
 * relay) e repassa as atualizações de pedidos e do cardápio aos painéis por
 * WebSocket.
 * Processo próprio: conexões longas ficam isoladas da API e um deploy da API
 * não derruba os painéis. Pode rodar em várias réplicas (fan-out pelo Redis).
 */
import { PRODUCT_UPDATES_TOPIC } from '../catalog/application/messages/product-update.message';
import { makeTokenAuthenticator } from '../identity/main/token-authenticator.factory';
import { ORDER_UPDATES_TOPIC } from '../ordering/application/messages/order-update.message';
import { RealtimeHub } from '../realtime/application/realtime-hub';
import { toRealtimeEvent } from '../realtime/infra/broker-envelope';
import { buildRealtimeApp } from '../realtime/presentation/realtime-app';
import { channelOf } from '../shared-kernel/infra/cache/redis/redis-message.publisher';
import { RedisSubscription } from '../shared-kernel/infra/cache/redis/redis-subscription';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { loadRealtimeEnv } from './config/realtime-env';

async function main(): Promise<void> {
  const env = loadRealtimeEnv();
  const clock = new SystemClock();
  const hub = new RealtimeHub();

  // O logger do Fastify só existe depois do app: até lá, avisos vão ao console.
  let warn = (message: string, error?: unknown): void => console.warn(message, error);
  // Tópicos públicos que o painel acompanha: pedidos e cardápio.
  const topics = [ORDER_UPDATES_TOPIC, PRODUCT_UPDATES_TOPIC];
  const subscription = await RedisSubscription.open(env.REDIS_URL, topics.map((topic) => channelOf(topic)), {
    connectionName: 'fastmeals-realtime-gateway',
    onMessage: (_channel, body) => {
      const event = toRealtimeEvent(body);
      if (event === null) warn('Mensagem do broker fora do envelope: descartada');
      else hub.broadcast(event);
    },
    onError: (error) => warn('Redis indisponível', error),
  });

  const app = await buildRealtimeApp({
    hub,
    authenticator: makeTokenAuthenticator(env.JWT_SECRET, clock),
    clock,
    requiredPermission: 'orders:read',
    allowedOrigins: env.REALTIME_ALLOWED_ORIGINS,
    healthChecks: { redis: () => subscription.isReady },
    logger: env.NODE_ENV !== 'test',
  });
  warn = (message, error) => app.log.warn({ err: error }, message);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando o gateway de tempo real');
    // Fecha as conexões com 1012 (clientes reconectam) antes de soltar o Redis.
    await app.close();
    await subscription.close();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.REALTIME_HOST, port: env.REALTIME_PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
