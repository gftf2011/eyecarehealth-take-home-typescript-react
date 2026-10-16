import { sql } from 'kysely';

import { makeCatalogRoutes } from '../catalog/main/catalog.module';
import type { CatalogDatabase } from '../catalog/infra/persistence/schema/catalog-database';
import { SystemClock } from '../shared-kernel/infra/clock/system-clock';
import { createKysely, createPostgresPool } from '../shared-kernel/infra/database/postgres';
import { PendingIdentityAuthenticator } from './auth/pending-identity.authenticator';
import { loadEnv } from './config/env';
import { buildApp } from './http/app';

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPostgresPool(env.DATABASE_URL);
  const clock = new SystemClock();

  const catalogDb = createKysely<CatalogDatabase>(pool);

  const app = await buildApp({
    routes: [...makeCatalogRoutes({ db: catalogDb, clock })],
    authenticator: new PendingIdentityAuthenticator(),
    healthCheck: async () => {
      await sql`SELECT 1`.execute(catalogDb);
    },
    logger: env.NODE_ENV !== 'test',
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando');
    await app.close();
    await pool.end();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
