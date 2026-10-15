import { sql, type Kysely } from 'kysely';

/**
 * Função de trigger para `updated_at`. O domínio continua sendo a fonte do
 * horário (via Clock); o trigger só preenche quando um UPDATE não altera a
 * coluna (ex.: SQL manual), para ela nunca ficar desatualizada.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at := now();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`.execute(db);
}
