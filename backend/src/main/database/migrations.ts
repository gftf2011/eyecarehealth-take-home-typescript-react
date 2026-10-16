import type { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';

import { catalogMigrations } from '../../catalog/infra/persistence/migrations';
import { identityMigrations } from '../../identity/infra/persistence/migrations';
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
];

export function allMigrations(): Record<string, Migration> {
  const merged: Record<string, Migration> = {};
  for (const set of MIGRATION_SETS) {
    for (const [name, migration] of Object.entries(set)) {
      if (name in merged) throw new Error(`Migration duplicada: ${name}`);
      merged[name] = migration;
    }
  }
  return merged;
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
