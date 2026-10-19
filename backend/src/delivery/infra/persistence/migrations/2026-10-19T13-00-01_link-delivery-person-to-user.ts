import { sql, type Kysely } from 'kysely';

/**
 * O usuário com que o entregador entra no sistema (perfil `courier`), se
 * houver. O vínculo é do Delivery: o Identity não sabe o que é um entregador.
 * Um usuário é no máximo um entregador ativo na frota (removidos não contam).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('delivery_persons')
    .addColumn('user_id', 'uuid', (col) => col.references('users.id'))
    .execute();
  await sql`
    CREATE UNIQUE INDEX uq_delivery_persons_user_id ON delivery_persons (user_id)
    WHERE user_id IS NOT NULL AND deleted_at IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX uq_delivery_persons_user_id`.execute(db);
  await db.schema.alterTable('delivery_persons').dropColumn('user_id').execute();
}
