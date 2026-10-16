import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

import { createKysely, createPostgresPool } from '../../../shared-kernel/infra/database/postgres';
import { migrateToLatest } from '../migrations';

const POSTGRES_IMAGE = 'postgres:17-alpine';
const REDIS_IMAGE = 'redis:7-alpine';

/**
 * Global setup dos projetos `integration` e `e2e`: sobe PostgreSQL (com as
 * migrations reais aplicadas) e Redis descartáveis (Testcontainers), uma vez
 * por execução, e expõe as URLs via `inject('databaseUrl' | 'redisUrl')`.
 * Exige Docker em execução.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('fastmeals_test').start(),
    new RedisContainer(REDIS_IMAGE).start(),
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

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
