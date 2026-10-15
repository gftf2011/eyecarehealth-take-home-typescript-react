import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('outbox_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('aggregate_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('aggregate_id', 'uuid', (col) => col.notNull())
    .addColumn('event_name', 'varchar(150)', (col) => col.notNull())
    .addColumn('event_version', 'integer', (col) => col.notNull().check(sql`event_version > 0`))
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('occurred_at', 'timestamptz', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0).check(sql`attempts >= 0`))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // O despachante busca só os pendentes, na ordem em que ocorreram.
  await db.schema
    .createIndex('idx_outbox_events_pending')
    .on('outbox_events')
    .column('occurred_at')
    .where(sql.ref('published_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('idx_outbox_events_aggregate')
    .on('outbox_events')
    .columns(['aggregate_type', 'aggregate_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('outbox_events').execute();
}
