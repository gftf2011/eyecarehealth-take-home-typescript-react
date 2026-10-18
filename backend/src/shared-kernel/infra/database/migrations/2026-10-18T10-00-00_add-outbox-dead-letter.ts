import { sql, type Kysely } from 'kysely';

/**
 * Fila morta no próprio outbox: a mensagem que falha `OUTBOX_MAX_ATTEMPTS`
 * vezes com erro permanente ganha `dead_lettered_at` e sai da fila de
 * pendentes, para não travar as que vêm depois. Fica guardada (a retenção
 * só apaga as entregues) até ser investigada e reprocessada.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('outbox_events')
    .addColumn('dead_lettered_at', 'timestamptz')
    .addColumn('last_error', 'text')
    .execute();

  // Pendentes = nem entregues nem mortas; o relay só olha estas.
  await db.schema.dropIndex('idx_outbox_events_pending').execute();
  await db.schema
    .createIndex('idx_outbox_events_pending')
    .on('outbox_events')
    .column('occurred_at')
    .where(sql<boolean>`published_at IS NULL AND dead_lettered_at IS NULL`)
    .execute();

  await db.schema
    .createIndex('idx_outbox_events_dead_lettered')
    .on('outbox_events')
    .column('dead_lettered_at')
    .where(sql.ref('dead_lettered_at'), 'is not', null)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_outbox_events_dead_lettered').execute();
  await db.schema.dropIndex('idx_outbox_events_pending').execute();
  await db.schema
    .createIndex('idx_outbox_events_pending')
    .on('outbox_events')
    .column('occurred_at')
    .where(sql.ref('published_at'), 'is', null)
    .execute();
  await db.schema.alterTable('outbox_events').dropColumn('last_error').dropColumn('dead_lettered_at').execute();
}
