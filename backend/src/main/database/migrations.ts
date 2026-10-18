import type { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';

import { catalogMigrations } from '../../catalog/infra/persistence/migrations';
import { deliveryMigrations } from '../../delivery/infra/persistence/migrations';
import { identityMigrations } from '../../identity/infra/persistence/migrations';
import { orderingMigrations } from '../../ordering/infra/persistence/migrations';
import { sharedKernelMigrations } from '../../shared-kernel/infra/database/migrations';

/**
 * Cada bounded context é dono das próprias migrations; aqui elas são reunidas.
 * O Migrator aplica em ordem alfabética do nome (prefixo de data/hora), então
 * tabelas de que outros contextos dependem são sempre criadas antes.
 */
const MIGRATION_SETS: readonly Record<string, Migration>[] = [
  sharedKernelMigrations,
  catalogMigrations,
  identityMigrations,
  deliveryMigrations,
  orderingMigrations,
];

/**
 * Todas as migrations, em ordem cronológica: um contexto pode ganhar uma
 * migration nova depois das dos outros (ex.: a fila morta do outbox).
 */
export function allMigrations(): Record<string, Migration> {
  const merged = new Map<string, Migration>();
  for (const set of MIGRATION_SETS) {
    for (const [name, migration] of Object.entries(set)) {
      if (merged.has(name)) throw new Error(`Migration duplicada: ${name}`);
      merged.set(name, migration);
    }
  }
  return Object.fromEntries([...merged].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Provider estático (imports explícitos, sem ler o disco): funciona igual com
 * tsx, Vitest e no bundle de produção.
 */
class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return allMigrations();
  }
}

export function createMigrator(db: Kysely<unknown>): Migrator {
  return new Migrator({ db, provider: new StaticMigrationProvider() });
}

/** Aplica as migrations pendentes; lança se alguma falhar. */
export async function migrateToLatest(db: Kysely<unknown>): Promise<string[]> {
  const { error, results = [] } = await createMigrator(db).migrateToLatest();
  if (error !== undefined) throw error;
  return results.map((result) => result.migrationName);
}
