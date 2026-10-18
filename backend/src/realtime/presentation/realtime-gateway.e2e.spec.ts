import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { WebSocket } from 'ws';

import { makeTokenAuthenticator } from '../../identity/main/token-authenticator.factory';
import { buildTestApp, TEST_SECRETS, type TestApp } from '../../main/http/testing/build-test-app';
import { ORDER_UPDATES_TOPIC } from '../../ordering/application/messages/order-update.message';
import { insertProduct } from '../../ordering/infra/persistence/testing/ordering-test-data';
import { connectToTestRedis } from '../../shared-kernel/infra/cache/redis/testing/test-redis';
import { channelOf } from '../../shared-kernel/infra/cache/redis/redis-channel';
import type { RedisConnection } from '../../shared-kernel/infra/cache/redis/redis-connection';
import { RedisSubscription } from '../../shared-kernel/infra/cache/redis/redis-subscription';
import { SystemClock } from '../../shared-kernel/infra/clock/system-clock';
import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import type { OutboxDatabase } from '../../shared-kernel/infra/outbox/outbox-events.table';
import { SnsMessagePublisher } from '../../shared-kernel/infra/messaging/aws/sns-message.publisher';
import { SqsQueueConsumer } from '../../shared-kernel/infra/messaging/aws/sqs-queue-consumer';
import { createTestMessaging } from '../../shared-kernel/infra/messaging/aws/testing/test-aws';
import { OutboxRelay } from '../../shared-kernel/infra/outbox/outbox-relay';
import { RealtimeHub } from '../application/realtime-hub';
import type { ServerMessage } from '../application/realtime-protocol';
import { toRealtimeEvent } from '../infra/broker-envelope';
import { RealtimeFanoutForwarder } from '../infra/realtime-fanout.forwarder';
import { buildRealtimeApp, REALTIME_PATH } from './realtime-app';

const BURGER_ID = '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b';
const ALLOWED_ORIGIN = 'http://localhost:3000';

type Client = {
  readonly socket: WebSocket;
  /** Mensagens recebidas, na ordem. */
  readonly messages: ServerMessage[];
  /** Resolve com o código e motivo quando a conexão fecha. */
  readonly closed: Promise<{ code: number; reason: string }>;
};

describe('Gateway de tempo real (API → outbox → relay → SNS → SQS → Redis → WebSocket)', () => {
  let api: TestApp;
  let gateway: FastifyInstance;
  let subscription: RedisSubscription;
  let redis: RedisConnection;
  let relay: OutboxRelay;
  let consumer: SqsQueueConsumer;
  /** Outra réplica do gateway: só assina o Redis, sem consumir a fila. */
  let replica: RedisSubscription;
  const replicaReceived: string[] = [];
  let url: string;
  /** Prefixo próprio dos canais: o Redis de teste é compartilhado. */
  const channelPrefix = `test:${randomUUID()}:`;

  beforeAll(async () => {
    api = await buildTestApp({ auth: 'jwt' });
    redis = await connectToTestRedis();
    const messaging = await createTestMessaging({ topics: [ORDER_UPDATES_TOPIC], visibilityTimeoutSeconds: 30 });
    relay = new OutboxRelay(
      api.orderingDb as unknown as Kysely<OutboxDatabase>,
      new SnsMessagePublisher(messaging.sns, messaging.topicArn),
      api.clock,
    );
    const forwarder = new RealtimeFanoutForwarder(redis, channelPrefix);
    consumer = new SqsQueueConsumer(messaging.sqs, {
      queueUrl: messaging.queue.url,
      handle: (message) => forwarder.forward(message.body),
      onError: () => undefined,
      clock: new SystemClock(),
      waitTimeSeconds: 1,
    });
    consumer.start();
    replica = await RedisSubscription.open(inject('redisUrl'), [channelOf(ORDER_UPDATES_TOPIC, channelPrefix)], {
      onMessage: (_channel, body) => replicaReceived.push(body),
      onError: () => undefined,
    });

    const hub = new RealtimeHub();
    subscription = await RedisSubscription.open(inject('redisUrl'), [channelOf(ORDER_UPDATES_TOPIC, channelPrefix)], {
      onMessage: (_channel, body) => {
        const event = toRealtimeEvent(body);
        if (event !== null) hub.broadcast(event);
      },
      onError: () => undefined,
    });
    gateway = await buildRealtimeApp({
      hub,
      // Mesmo relógio da API: os tokens são emitidos no "agora" do teste.
      authenticator: makeTokenAuthenticator(TEST_SECRETS.accessToken, api.clock),
      clock: api.clock,
      requiredPermission: 'orders:read',
      allowedOrigins: [ALLOWED_ORIGIN],
      healthChecks: { redis: () => subscription.isReady, queue: () => consumer.isAlive(60_000) },
      authTimeoutMs: 300,
    });
    await gateway.listen({ host: '127.0.0.1', port: 0 });
    url = `ws://127.0.0.1:${(gateway.server.address() as AddressInfo).port}${REALTIME_PATH}`;
  });

  beforeEach(async () => {
    await resetDatabase(api.orderingDb);
    await insertProduct(api.orderingDb as unknown as Kysely<unknown>, { id: BURGER_ID, price: '32.90' });
  });

  afterAll(async () => {
    await consumer.stop();
    await gateway.close();
    await Promise.all([subscription.close(), replica.close()]);
    await redis.close();
    await api.close();
  });

  async function accessToken(email: string, password: string, role: 'admin' | 'viewer'): Promise<string> {
    await api.givenUser(email, password, role);
    const login = await api.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
    return login.json().accessToken;
  }

  function connect(origin = ALLOWED_ORIGIN, target = url): Promise<Client> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(target, { headers: { origin } });
      const messages: ServerMessage[] = [];
      const closed = new Promise<{ code: number; reason: string }>((onClose) =>
        socket.on('close', (code, reason) => onClose({ code, reason: reason.toString() })),
      );
      socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as ServerMessage));
      socket.once('open', () => resolve({ socket, messages, closed }));
      socket.once('unexpected-response', (_request, response) =>
        reject(new Error(`handshake recusado: ${response.statusCode}`)),
      );
      socket.once('error', reject);
    });
  }

  async function authenticate(client: Client, token: string): Promise<void> {
    client.socket.send(JSON.stringify({ type: 'auth', accessToken: token }));
    await expect.poll(() => client.messages.some((message) => message.type === 'ready')).toBe(true);
  }

  it('o painel autenticado recebe order.placed quando um pedido é criado na API', async () => {
    const viewer = await accessToken(`viewer-${randomUUID()}@fastmeals.com`, 'Viewer@123', 'viewer');
    const admin = await accessToken(`admin-${randomUUID()}@fastmeals.com`, 'Admin@123', 'admin');
    const client = await connect();
    await authenticate(client, viewer);

    const placed = await api.app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { authorization: `Bearer ${admin}` },
      payload: {
        customerName: 'Maria Oliveira',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        items: [{ productId: BURGER_ID, quantity: 2 }],
      },
    });
    const orderId: string = placed.json().id;
    const startedAt = performance.now();
    expect(await relay.relayBatch(10)).toEqual({ published: 1, failed: 0 });

    await expect
      .poll(() => client.messages.find((message) => message.type === 'event'), { timeout: 2_000 })
      .toMatchObject({
        type: 'event',
        topic: ORDER_UPDATES_TOPIC,
        id: expect.any(String),
        payload: { type: 'order.placed', orderId, status: 'pending', totalAmount: 65.8 },
      });
    expect(performance.now() - startedAt).toBeLessThan(2_000);
    // A fila entregou uma vez; o Redis levou o evento também à outra réplica.
    await expect.poll(() => replicaReceived.length).toBe(1);
    expect(client.messages.filter((message) => message.type === 'event')).toHaveLength(1);
    client.socket.close();
  });

  it('sem autenticação no prazo, o servidor fecha com 4401', async () => {
    const client = await connect();

    expect(await client.closed).toEqual({ code: 4401, reason: 'Autenticação não recebida no prazo' });
  });

  it('token inválido fecha com 4401 e não recebe eventos', async () => {
    const client = await connect();
    client.socket.send(JSON.stringify({ type: 'auth', accessToken: 'não-é-um-jwt' }));

    expect((await client.closed).code).toBe(4401);
    expect(client.messages).toEqual([]);
  });

  it('origem de navegador não autorizada é recusada no handshake', async () => {
    await expect(connect('https://site-malicioso.example')).rejects.toThrow('handshake recusado: 403');
  });

  it('ao encerrar o gateway, todos os clientes recebem 1012 para reconectar', async () => {
    const viewer = await accessToken(`viewer-${randomUUID()}@fastmeals.com`, 'Viewer@123', 'viewer');
    const ephemeral = await buildRealtimeApp({
      hub: new RealtimeHub(),
      authenticator: makeTokenAuthenticator(TEST_SECRETS.accessToken, api.clock),
      clock: api.clock,
      requiredPermission: 'orders:read',
      allowedOrigins: [ALLOWED_ORIGIN],
      healthChecks: {},
    });
    await ephemeral.listen({ host: '127.0.0.1', port: 0 });
    const ephemeralUrl = `ws://127.0.0.1:${(ephemeral.server.address() as AddressInfo).port}${REALTIME_PATH}`;
    const authenticated = await connect(ALLOWED_ORIGIN, ephemeralUrl);
    await authenticate(authenticated, viewer);
    const pending = await connect(ALLOWED_ORIGIN, ephemeralUrl);

    await ephemeral.close();

    expect(await authenticated.closed).toEqual({ code: 1012, reason: 'Servidor reiniciando' });
    expect((await pending.closed).code).toBe(1012);
  });

  it('health informa o Redis, a fila e as conexões abertas', async () => {
    const viewer = await accessToken(`viewer-${randomUUID()}@fastmeals.com`, 'Viewer@123', 'viewer');
    const client = await connect();
    await authenticate(client, viewer);

    const health = await gateway.inject({ method: 'GET', url: '/health' });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: 'ok',
      checks: { redis: 'up', queue: 'up' },
      connections: { open: 1, authenticated: 1 },
    });
    client.socket.close();
    await client.closed;
  });
});
