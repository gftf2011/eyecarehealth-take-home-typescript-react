import { afterEach, describe, expect, it } from 'vitest';

import { RedisConnection } from '../../shared-kernel/infra/cache/redis/redis-connection';
import { RedisRateLimitCounter } from '../../shared-kernel/infra/cache/redis/redis-rate-limit.counter';
import {
  connectToTestRedis,
  isolatedRedisCounter,
} from '../../shared-kernel/infra/cache/redis/testing/test-redis';
import { ADMIN_TOKEN, bearer } from '../../shared-kernel/presentation/testing/static-authenticator';
import { buildTestApp, type TestApp } from './testing/build-test-app';

const WINDOW_MS = 60_000;

/** Lista produtos chegando por 127.0.0.1, opcionalmente com `X-Forwarded-For`. */
function listProducts(testApp: TestApp, options: { forwardedFor?: string } = {}) {
  return testApp.app.inject({
    method: 'GET',
    url: '/api/products',
    remoteAddress: '127.0.0.1',
    headers: {
      ...bearer(ADMIN_TOKEN),
      ...(options.forwardedFor !== undefined && { 'x-forwarded-for': options.forwardedFor }),
    },
  });
}

describe('rate limit (Redis)', () => {
  const apps: TestApp[] = [];
  const connections: RedisConnection[] = [];

  async function app(...args: Parameters<typeof buildTestApp>): Promise<TestApp> {
    const created = await buildTestApp(...args);
    apps.push(created);
    return created;
  }

  async function redis(): Promise<RedisConnection> {
    const connection = await connectToTestRedis();
    connections.push(connection);
    return connection;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((created) => created.close()));
    await Promise.all(connections.splice(0).map((connection) => connection.close()));
  });

  it('compartilha o limite entre réplicas da API', async () => {
    const shared = isolatedRedisCounter(await redis(), 'replicas');
    const replicaA = await app({ rateLimit: { max: 3, timeWindowMs: WINDOW_MS, counter: shared } });
    const replicaB = await app({ rateLimit: { max: 3, timeWindowMs: WINDOW_MS, counter: shared } });

    const statuses = [
      (await listProducts(replicaA)).statusCode,
      (await listProducts(replicaA)).statusCode,
      (await listProducts(replicaB)).statusCode,
      (await listProducts(replicaB)).statusCode,
    ];

    // Se cada réplica contasse sozinha, o limite efetivo dobraria.
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it('429 RATE_LIMIT_EXCEEDED no formato padrão, com Retry-After', async () => {
    const testApp = await app({ rateLimit: { max: 1, timeWindowMs: WINDOW_MS } });

    await listProducts(testApp);
    const limited = await listProducts(testApp);

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('com o Redis fora do ar, a API continua respondendo (fail-open) e o health acusa', async () => {
    const unreachable = RedisConnection.open('redis://127.0.0.1:1', { onError: () => undefined });
    connections.push(unreachable);
    const testApp = await app({
      rateLimit: { max: 1, counter: new RedisRateLimitCounter(unreachable) },
      extraHealthChecks: { redis: () => unreachable.ping() },
    });

    const statuses = [
      (await listProducts(testApp)).statusCode,
      (await listProducts(testApp)).statusCode,
    ];
    const health = await testApp.app.inject({ method: 'GET', url: '/api/health' });

    expect(statuses).toEqual([200, 200]);
    expect(health.statusCode).toBe(503);
    expect(health.json()).toEqual({
      status: 'degraded',
      checks: { database: 'up', redis: 'down' },
    });
  });

  describe('IP do cliente atrás de proxy', () => {
    it('com o proxy confiável, cada cliente real tem o próprio limite', async () => {
      const testApp = await app({ rateLimit: { max: 2 }, trustProxy: ['127.0.0.1'] });

      const first = [
        (await listProducts(testApp, { forwardedFor: '203.0.113.10' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '203.0.113.10' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '203.0.113.10' })).statusCode,
      ];
      const other = (await listProducts(testApp, { forwardedFor: '203.0.113.20' })).statusCode;

      expect(first).toEqual([200, 200, 429]);
      expect(other).toBe(200);
    });

    it('sem confiar no proxy, X-Forwarded-For forjado não escapa do limite', async () => {
      const testApp = await app({ rateLimit: { max: 2 } });

      const statuses = [
        (await listProducts(testApp, { forwardedFor: '198.51.100.1' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '198.51.100.2' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '198.51.100.3' })).statusCode,
      ];

      expect(statuses).toEqual([200, 200, 429]);
    });
  });
});
