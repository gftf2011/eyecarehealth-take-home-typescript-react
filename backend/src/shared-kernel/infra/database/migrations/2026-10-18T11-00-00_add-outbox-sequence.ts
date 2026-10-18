import { sql, type Kysely } from 'kysely';

/**
 * Ordem de publicação confiável para o SNS FIFO. `occurred_at` vem do
 * relógio de cada transação e pode empatar ou inverter entre duas; a
 * `sequence` é dada pelo banco na inserção. Como as transações que mexem num
 * mesmo agregado são serializadas pelo lock da linha, a sequência de um
 * agregado sempre cresce na ordem em que os eventos aconteceram.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE outbox_events ADD COLUMN sequence bigint GENERATED ALWAYS AS IDENTITY`.execute(db);

  await db.schema.dropIndex('idx_outbox_events_pending').execute();
  await db.schema
    .createIndex('idx_outbox_events_pending')
    .on('outbox_events')
    .columns(['aggregate_type', 'aggregate_id', 'sequence'])
    .where(sql<boolean>`published_at IS NULL AND dead_lettered_at IS NULL`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_outbox_events_pending').execute();
  await db.schema
    .createIndex('idx_outbox_events_pending')
    .on('outbox_events')
    .column('occurred_at')
    .where(sql<boolean>`published_at IS NULL AND dead_lettered_at IS NULL`)
    .execute();
  await db.schema.alterTable('outbox_events').dropColumn('sequence').execute();
}
