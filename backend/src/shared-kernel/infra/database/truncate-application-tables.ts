import { sql, type Kysely } from 'kysely';

/** Tabelas de controle do migrator: nunca são esvaziadas. */
const MIGRATION_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);

/**
 * Esvazia todas as tabelas da aplicação (mantém o schema e o controle de
 * migrations). Destrutivo: só para testes e para o seed com `--reset` fora
 * de produção.
 */
export async function truncateApplicationTables<TDatabase>(db: Kysely<TDatabase>): Promise<void> {
  const { rows } = await sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `.execute(db);

  const tables = rows.map((row) => row.tablename).filter((name) => !MIGRATION_TABLES.has(name));
  if (tables.length === 0) return;

  await sql`TRUNCATE TABLE ${sql.join(tables.map((name) => sql.table(name)))} RESTART IDENTITY CASCADE`.execute(
    db,
  );
}
