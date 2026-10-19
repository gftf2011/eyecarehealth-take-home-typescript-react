import { sql, type Kysely } from 'kysely';

/**
 * Motivo de uma transição, quando ela exige um: a entrega em andamento que o
 * gestor devolve para a atribuição (`delivering → ready`). As outras ficam
 * com `null`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('order_status_history')
    .addColumn('reason', 'varchar(200)', (col) =>
      col.check(sql`reason is null or char_length(reason) between 3 and 200`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('order_status_history').dropColumn('reason').execute();
}
