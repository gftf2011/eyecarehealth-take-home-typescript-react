import { sql, type Kysely } from 'kysely';

/**
 * Paginação por keyset: cada ordenação da listagem ganha um índice
 * `(coluna, id)`, na mesma direção do desempate, e a consulta continua do
 * último item da página em vez de pular `OFFSET` linhas.
 *
 * `created_at` passa a guardar milissegundos, a mesma precisão do `Date` que
 * vai no cursor: com microssegundos, dois produtos no mesmo milissegundo
 * poderiam ser pulados entre uma página e outra.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE products ALTER COLUMN created_at TYPE timestamptz(3)`.execute(db);

  await sql`DROP INDEX idx_products_created_at`.execute(db);
  await sql`DROP INDEX idx_products_name`.execute(db);
  await sql`DROP INDEX idx_products_price`.execute(db);
  await sql`CREATE INDEX idx_products_created_at ON products (created_at, id) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_name ON products (name, id) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_price ON products (price, id) WHERE deleted_at IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_products_created_at`.execute(db);
  await sql`DROP INDEX idx_products_name`.execute(db);
  await sql`DROP INDEX idx_products_price`.execute(db);
  await sql`CREATE INDEX idx_products_created_at ON products (created_at DESC, id) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_name ON products (name) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_price ON products (price) WHERE deleted_at IS NULL`.execute(db);
  await sql`ALTER TABLE products ALTER COLUMN created_at TYPE timestamptz`.execute(db);
}
