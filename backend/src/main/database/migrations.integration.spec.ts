import { sql, type Kysely } from 'kysely';
import { NO_MIGRATIONS } from 'kysely/migration';
import { afterAll, describe, expect, it } from 'vitest';

import { connectToTestDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import { allMigrations, createMigrator, migrateToLatest } from './migrations';

async function publicTables(db: Kysely<unknown>): Promise<string[]> {
  const { rows } = await sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `.execute(db);
  return rows.map((row) => row.tablename);
}

describe('migrations', () => {
  const db = connectToTestDatabase<unknown>();

  afterAll(async () => {
    await migrateToLatest(db);
    await db.destroy();
  });

  it('nomes seguem o padrão <timestamp>_<descrição> e estão em ordem cronológica', () => {
    const names = Object.keys(allMigrations());
    expect(names.every((name) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_[a-z0-9-]+$/.test(name))).toBe(
      true,
    );
    expect([...names].sort()).toEqual(names);
  });

  it('criam as tabelas da aplicação', async () => {
    expect(await publicTables(db)).toEqual(
      expect.arrayContaining([
        'outbox_events',
        'products',
        'users',
        'refresh_sessions',
        'delivery_persons',
        'orders',
        'order_items',
        'order_status_history',
        'kysely_migration',
      ]),
    );
  });

  it('são reversíveis: desfazer tudo e reaplicar volta ao mesmo schema', async () => {
    const migrator = createMigrator(db);

    const down = await migrator.migrateTo(NO_MIGRATIONS);
    expect(down.error).toBeUndefined();
    expect(await publicTables(db)).not.toContain('products');

    const applied = await migrateToLatest(db);
    expect(applied).toEqual(Object.keys(allMigrations()));
    expect(await publicTables(db)).toContain('products');
  });

  it('são idempotentes: rodar de novo não aplica nada', async () => {
    expect(await migrateToLatest(db)).toEqual([]);
  });
});
