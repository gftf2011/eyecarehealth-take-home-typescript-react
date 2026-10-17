import type { Kysely } from 'kysely';
import { inject } from 'vitest';

import { createKysely, createPostgresPool } from '../postgres';
import { truncateApplicationTables } from '../truncate-application-tables';

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

/** Esvazia todas as tabelas da aplicação (mantém o controle de migrations). */
export async function resetDatabase<TDatabase>(db: Kysely<TDatabase>): Promise<void> {
  await truncateApplicationTables(db);
}
