import { sql, type Kysely } from 'kysely';

/**
 * Tentativas de entrega que falharam, relatadas pelo entregador: parte do
 * agregado Order (como itens e histórico). Ficam depois de resolvidas: é o
 * histórico das tentativas. Só o gestor resolve (tentar de novo, devolver,
 * cancelar). O banco garante no máximo um problema aberto por pedido, e que
 * resolução e data andam juntas.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('order_delivery_issues')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .addColumn('reason', 'varchar(30)', (col) =>
      col.notNull().check(sql`reason in ('customer_absent', 'address_not_found', 'refused', 'other')`),
    )
    .addColumn('note', 'varchar(150)', (col) => col.check(sql`note is null or char_length(note) between 1 and 150`))
    .addColumn('reported_by', 'uuid', (col) => col.notNull().references('delivery_persons.id'))
    .addColumn('reported_at', 'timestamptz', (col) => col.notNull())
    .addColumn('resolved_at', 'timestamptz')
    .addColumn('resolution', 'varchar(20)', (col) =>
      col.check(sql`resolution in ('retried', 'returned', 'cancelled')`),
    )
    .addCheckConstraint('order_delivery_issues_resolution', sql`(resolved_at is null) = (resolution is null)`)
    .addCheckConstraint('order_delivery_issues_other_note', sql`reason <> 'other' or note is not null`)
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_order_delivery_issues_open ON order_delivery_issues (order_id)
    WHERE resolved_at IS NULL
  `.execute(db);
  await sql`CREATE INDEX idx_order_delivery_issues_order_id ON order_delivery_issues (order_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('order_delivery_issues').execute();
}
