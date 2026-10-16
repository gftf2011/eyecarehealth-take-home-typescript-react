import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('delivery_persons')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('name', 'varchar(100)', (col) =>
      col.notNull().check(sql`char_length(name) between 3 and 100`),
    )
    .addColumn('phone', 'varchar(20)', (col) =>
      col.notNull().check(sql`phone ~ '^\\(\\d{2}\\) \\d{5}-\\d{4}$'`),
    )
    .addColumn('vehicle_type', 'varchar(20)', (col) =>
      col.notNull().check(sql`vehicle_type in ('bicycle', 'motorcycle', 'car')`),
    )
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('current_latitude', 'numeric(10, 8)', (col) =>
      col.check(sql`current_latitude between -90 and 90`),
    )
    .addColumn('current_longitude', 'numeric(11, 8)', (col) =>
      col.check(sql`current_longitude between -180 and 180`),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    // Soft delete: pedidos antigos continuam referenciando (e exibindo) o entregador.
    .addColumn('deleted_at', 'timestamptz')
    // Localização é um ponto: as duas coordenadas existem juntas ou nenhuma.
    .addCheckConstraint(
      'delivery_persons_location_complete',
      sql`(current_latitude IS NULL) = (current_longitude IS NULL)`,
    )
    .execute();

  await sql`
    CREATE TRIGGER trg_delivery_persons_updated_at
    BEFORE UPDATE ON delivery_persons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  // Candidatos à atribuição: ativos e não removidos.
  await sql`CREATE INDEX idx_delivery_persons_is_active ON delivery_persons (is_active) WHERE deleted_at IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('delivery_persons').execute();
}
