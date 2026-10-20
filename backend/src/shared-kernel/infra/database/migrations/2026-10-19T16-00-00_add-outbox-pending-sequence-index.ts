import { sql, type Kysely } from 'kysely';

/**
 * O relay escolhe o lote pelas pendentes mais antigas (`ORDER BY sequence
 * LIMIT n`): com este índice parcial, ele lê só o começo da fila, e o custo
 * de um lote não cresce com o backlog. O índice por agregado continua, para
 * ler as pendentes de cada agregado travado.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX idx_outbox_events_pending_sequence ON outbox_events (sequence)
    WHERE published_at IS NULL AND dead_lettered_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_outbox_events_pending_sequence`.execute(db);
}
