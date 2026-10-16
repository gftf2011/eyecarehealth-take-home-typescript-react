import { sql, type Kysely } from 'kysely';
import { inject } from 'vitest';

import { createKysely, createPostgresPool } from '../postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL do PostgreSQL de teste, já migrado (ver containers-global-setup). */
    databaseUrl: string;
  }
}

/** Kysely tipado para o banco de teste do projeto `integration`. */
export function connectToTestDatabase<TDatabase>(): Kysely<TDatabase> {
  return createKysely<TDatabase>(createPostgresPool(inject('databaseUrl')));
}

const MIGRATION_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);

/** Esvazia todas as tabelas da aplicação (mantém o controle de migrations). */
export async function resetDatabase<TDatabase>(db: Kysely<TDatabase>): Promise<void> {
  const { rows } = await sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `.execute(db);

  const tables = rows.map((row) => row.tablename).filter((name) => !MIGRATION_TABLES.has(name));
  if (tables.length === 0) return;

  await sql`TRUNCATE TABLE ${sql.join(tables.map((name) => sql.table(name)))} RESTART IDENTITY CASCADE`.execute(
    db,
  );
}
