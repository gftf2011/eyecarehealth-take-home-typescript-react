import { sql, type Kysely } from 'kysely';

/**
 * Paginação por keyset: os índices `(coluna, id)` de cada ordenação já
 * existiam; falta o do filtro por status ordenado pelo valor.
 *
 * `created_at` passa a guardar milissegundos, a mesma precisão do `Date` que
 * vai no cursor: com microssegundos, dois pedidos no mesmo milissegundo
 * poderiam ser pulados entre uma página e outra.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE orders ALTER COLUMN created_at TYPE timestamptz(3)`.execute(db);
  await sql`CREATE INDEX idx_orders_status_total ON orders (status, total_amount DESC, id DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_orders_status_total`.execute(db);
  await sql`ALTER TABLE orders ALTER COLUMN created_at TYPE timestamptz`.execute(db);
}
