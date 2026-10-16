import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';

import { makeCatalogRoutes } from '../../../catalog/main/catalog.module';
import type { CatalogDatabase } from '../../../catalog/infra/persistence/schema/catalog-database';
import { DEFAULT_AUTH_POLICY, type AuthPolicy } from '../../../identity/application/config/auth-policy';
import { Email, Role, User, UserId, type RoleValue } from '../../../identity/domain';
import { makeIdentityModule } from '../../../identity/main/identity.module';
import type { IdentityDatabase } from '../../../identity/infra/persistence/schema/identity-database';
import { KyselyIdentityUnitOfWork } from '../../../identity/infra/persistence/unit-of-work/kysely-identity-unit-of-work';
import type { Clock } from '../../../shared-kernel/application';
import { FixedClock } from '../../../shared-kernel/application/testing/fixed-clock';
import {
  connectToTestRedis,
  isolatedRedisCounter,
} from '../../../shared-kernel/infra/cache/redis/testing/test-redis';
import { connectToTestDatabase } from '../../../shared-kernel/infra/database/testing/test-database';
import type { Route } from '../../../shared-kernel/presentation';
import { StaticAuthenticator } from '../../../shared-kernel/presentation/testing/static-authenticator';
import { buildApp, type AppOptions, type HealthChecks, type RateLimitOptions } from '../app';

export const TEST_SECRETS = {
  accessToken: 'test-access-secret-with-at-least-32-chars',
  refreshToken: 'test-refresh-secret-with-at-least-32-chars',
};

/** Instante inicial do relógio do app de teste. */
export const TEST_APP_START = new Date('2025-02-01T12:00:00Z');

export type TestApp = {
  readonly app: FastifyInstance;
  readonly db: Kysely<CatalogDatabase>;
  readonly identityDb: Kysely<IdentityDatabase>;
  readonly clock: FixedClock;
  /** Cadastra um usuário com senha real (bcrypt) para os testes de autenticação. */
  givenUser(email: string, password: string, role: RoleValue): Promise<User>;
  close(): Promise<void>;
};

export type TestAppOverrides = Partial<Pick<AppOptions, 'trustProxy'>> & {
  /** Padrão: limite alto, contador Redis isolado para este app. */
  readonly rateLimit?: Partial<RateLimitOptions>;
  /**
   * `static`: tokens fixos de teste (padrão, foco no recurso testado).
   * `jwt`: autenticação real do Identity (login, JWT, refresh).
   */
  readonly auth?: 'static' | 'jwt';
  readonly authPolicy?: AuthPolicy;
  readonly extraRoutes?: (clock: Clock) => Route[];
  readonly extraHealthChecks?: HealthChecks;
};

/**
 * App completo para testes e2e, com as mesmas dependências de produção:
 * PostgreSQL e Redis reais (Testcontainers). Requisições via `app.inject`.
 */
export async function buildTestApp(overrides: TestAppOverrides = {}): Promise<TestApp> {
  const db = connectToTestDatabase<CatalogDatabase>();
  const identityDb = connectToTestDatabase<IdentityDatabase>();
  const redis = await connectToTestRedis();
  const clock = new FixedClock(TEST_APP_START);

  const identity = makeIdentityModule({
    db: identityDb,
    clock,
    secrets: TEST_SECRETS,
    policy: overrides.authPolicy ?? DEFAULT_AUTH_POLICY,
    bcryptCost: 10,
    secureCookies: true,
    loginAttempts: isolatedRedisCounter(redis, 'login-failures'),
  });

  const app = await buildApp({
    routes: [
      ...identity.routes,
      ...makeCatalogRoutes({ db, clock }),
      ...(overrides.extraRoutes?.(clock) ?? []),
    ],
    authenticator: overrides.auth === 'jwt' ? identity.authenticator : new StaticAuthenticator(),
    healthChecks: {
      database: async () => {
        await sql`SELECT 1`.execute(db);
      },
      redis: () => redis.ping(),
      ...overrides.extraHealthChecks,
    },
    rateLimit: {
      max: 10_000,
      timeWindowMs: 60_000,
      counter: isolatedRedisCounter(redis, 'rate-limit'),
      ...overrides.rateLimit,
    },
    ...(overrides.trustProxy !== undefined && { trustProxy: overrides.trustProxy }),
  });
  await app.ready();

  const identityUnitOfWork = new KyselyIdentityUnitOfWork(identityDb);

  return {
    app,
    db,
    identityDb,
    clock,
    givenUser: async (email, password, role) => {
      const user = User.register({
        id: UserId.generate(),
        email: Email.create(email),
        passwordHash: await identity.passwordHasher.hash(password),
        role: Role.of(role),
        now: clock.now(),
      });
      await identityUnitOfWork.transaction(({ users }) => users.save(user));
      return user;
    },
    close: async () => {
      await app.close();
      await Promise.all([db.destroy(), identityDb.destroy(), redis.close()]);
    },
  };
}
