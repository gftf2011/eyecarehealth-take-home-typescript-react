import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';

import { makeCatalogRoutes } from '../../../catalog/main/catalog.module';
import type { CatalogDatabase } from '../../../catalog/infra/persistence/schema/catalog-database';
import type { Clock } from '../../../shared-kernel/application';
import { FixedClock } from '../../../shared-kernel/application/testing/fixed-clock';
import { connectToTestDatabase } from '../../../shared-kernel/infra/database/testing/test-database';
import type { Route } from '../../../shared-kernel/presentation';
import { StaticAuthenticator } from '../../../shared-kernel/presentation/testing/static-authenticator';
import { buildApp, type AppOptions } from '../app';

export type TestApp = {
  readonly app: FastifyInstance;
  readonly db: Kysely<CatalogDatabase>;
  readonly clock: FixedClock;
  close(): Promise<void>;
};

/**
 * App completo para testes e2e: rotas reais, banco real (Testcontainers) e
 * autenticador de teste. Requisições via `app.inject`, sem abrir porta.
 */
export async function buildTestApp(
  overrides: Partial<Pick<AppOptions, 'rateLimit'>> & { extraRoutes?: (clock: Clock) => Route[] } = {},
): Promise<TestApp> {
  const db = connectToTestDatabase<CatalogDatabase>();
  const clock = new FixedClock(new Date('2025-02-01T12:00:00Z'));

  const app = await buildApp({
    routes: [...makeCatalogRoutes({ db, clock }), ...(overrides.extraRoutes?.(clock) ?? [])],
    authenticator: new StaticAuthenticator(),
    healthCheck: async () => {
      await sql`SELECT 1`.execute(db);
    },
    rateLimit: overrides.rateLimit ?? { max: 10_000, timeWindowMs: 60_000 },
  });
  await app.ready();

  return {
    app,
    db,
    clock,
    close: async () => {
      await app.close();
      await db.destroy();
    },
  };
}
