import { randomUUID } from 'node:crypto';

import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RedisConnection } from '../../shared-kernel/infra/cache/redis/redis-connection';
import { RedisRateLimitCounter } from '../../shared-kernel/infra/cache/redis/redis-rate-limit.counter';
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

describe('rate limit', () => {
  const apps: TestApp[] = [];
  const connections: RedisConnection[] = [];

  async function app(...args: Parameters<typeof buildTestApp>): Promise<TestApp> {
    const created = await buildTestApp(...args);
    apps.push(created);
    return created;
  }

  /** Erros de conexão são esperados no teste de Redis fora do ar. */
  function connect(url: string): RedisConnection {
    const connection = RedisConnection.open(url, { onError: () => undefined });
    connections.push(connection);
    return connection;
  }

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((created) => created.close()));
    await Promise.all(connections.splice(0).map((connection) => connection.close()));
  });

  describe('com Redis (produção)', () => {
    let container: StartedRedisContainer;

    beforeAll(async () => {
      container = await new RedisContainer('redis:7-alpine').start();
    });

    afterAll(async () => {
      await container.stop();
    });

    it('compartilha o limite entre réplicas da API', async () => {
      const keyPrefix = `test:${randomUUID()}:`;
      const replica = async (): Promise<TestApp> => {
        const connection = connect(container.getConnectionUrl());
        await connection.ready();
        const counter = new RedisRateLimitCounter(connection, keyPrefix);
        return app({ rateLimit: { max: 3, timeWindowMs: WINDOW_MS, counter } });
      };
      const replicaA = await replica();
      const replicaB = await replica();

      const statuses = [
        (await listProducts(replicaA)).statusCode,
        (await listProducts(replicaA)).statusCode,
        (await listProducts(replicaB)).statusCode,
        (await listProducts(replicaB)).statusCode,
      ];

      // Em memória, cada réplica aceitaria 3: o limite efetivo dobraria.
      expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it('com o Redis fora do ar, a API continua respondendo (fail-open) e o health acusa', async () => {
      const unreachable = connect('redis://127.0.0.1:1');
      const testApp = await app({
        rateLimit: {
          max: 1,
          timeWindowMs: WINDOW_MS,
          counter: new RedisRateLimitCounter(unreachable),
        },
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
  });

  describe('IP do cliente atrás de proxy', () => {
    it('com o proxy confiável, cada cliente real tem o próprio limite', async () => {
      const testApp = await app({
        rateLimit: { max: 2, timeWindowMs: WINDOW_MS },
        trustProxy: ['127.0.0.1'],
      });

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
      const testApp = await app({ rateLimit: { max: 2, timeWindowMs: WINDOW_MS } });

      const statuses = [
        (await listProducts(testApp, { forwardedFor: '198.51.100.1' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '198.51.100.2' })).statusCode,
        (await listProducts(testApp, { forwardedFor: '198.51.100.3' })).statusCode,
      ];

      expect(statuses).toEqual([200, 200, 429]);
    });
  });
});
