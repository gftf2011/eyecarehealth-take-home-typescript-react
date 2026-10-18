import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

import { createKysely, createPostgresPool } from '../../../shared-kernel/infra/database/postgres';
import { migrateToLatest } from '../migrations';

const POSTGRES_IMAGE = 'postgres:17-alpine';
const REDIS_IMAGE = 'redis:7-alpine';
/** Emulador de AWS (SNS/SQS); a mesma versão do docker-compose. */
const FLOCI_IMAGE = 'floci/floci:2.1.0';
const FLOCI_PORT = 4566;

/**
 * Global setup dos projetos `integration` e `e2e`: sobe PostgreSQL (com as
 * migrations reais aplicadas), Redis e Floci (SNS/SQS) descartáveis
 * (Testcontainers), uma vez por execução, e expõe os endereços via
 * `inject('databaseUrl' | 'redisUrl' | 'awsEndpoint')`.
 * Exige Docker em execução.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis, floci] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('fastmeals_test').start(),
    new RedisContainer(REDIS_IMAGE).start(),
    new GenericContainer(FLOCI_IMAGE)
      .withExposedPorts(FLOCI_PORT)
      .withWaitStrategy(Wait.forHttp('/_floci/health', FLOCI_PORT))
      .start(),
  ]);

  const databaseUrl = postgres.getConnectionUri();
  const db = createKysely<unknown>(createPostgresPool(databaseUrl));
  try {
    await migrateToLatest(db);
  } finally {
    await db.destroy();
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('redisUrl', redis.getConnectionUrl());
  project.provide('awsEndpoint', `http://${floci.getHost()}:${floci.getMappedPort(FLOCI_PORT)}`);

  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), floci.stop()]);
  };
}
