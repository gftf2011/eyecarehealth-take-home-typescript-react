import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

import { createKysely, createPostgresPool } from '../../../shared-kernel/infra/database/postgres';
import { migrateToLatest } from '../migrations';

const POSTGRES_IMAGE = 'postgres:17-alpine';

/**
 * Global setup do projeto `integration` do Vitest: sobe um PostgreSQL
 * descartável (Testcontainers), aplica as migrations reais e expõe a URL de
 * conexão aos testes via `inject('databaseUrl')`. Exige Docker em execução.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('fastmeals_test')
    .start();

  const databaseUrl = container.getConnectionUri();
  const db = createKysely<unknown>(createPostgresPool(databaseUrl));
  try {
    await migrateToLatest(db);
  } finally {
    await db.destroy();
  }

  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
