import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/** Pool de conexões único da aplicação, compartilhado por todos os contextos. */
export function createPostgresPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

/**
 * Cria um Kysely tipado com as tabelas de um contexto, sobre o pool comum.
 * Cada bounded context declara só as tabelas que usa (ex.: `CatalogDatabase`)
 * e não enxerga as dos outros, mesmo compartilhando o banco.
 */
export function createKysely<TDatabase>(pool: pg.Pool): Kysely<TDatabase> {
  return new Kysely<TDatabase>({ dialect: new PostgresDialect({ pool }) });
}
