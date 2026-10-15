import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('products')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('name', 'varchar(120)', (col) =>
      col.notNull().check(sql`char_length(name) between 3 and 120`),
    )
    .addColumn('description', 'varchar(500)', (col) =>
      col.notNull().check(sql`char_length(description) between 10 and 500`),
    )
    .addColumn('price', 'numeric(10, 2)', (col) => col.notNull().check(sql`price > 0`))
    .addColumn('category', 'varchar(20)', (col) =>
      col.notNull().check(sql`category in ('meal', 'drink', 'dessert', 'side')`),
    )
    .addColumn('image_url', 'varchar(500)')
    .addColumn('is_available', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('preparation_time', 'integer', (col) =>
      col.notNull().check(sql`preparation_time between 1 and 120`),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    // Soft delete: pedidos antigos continuam referenciando o produto.
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await sql`
    CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  // Índices parciais: as listagens nunca olham produtos removidos.
  await sql`CREATE INDEX idx_products_created_at ON products (created_at DESC, id) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_category ON products (category) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_is_available ON products (is_available) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_name ON products (name) WHERE deleted_at IS NULL`.execute(db);
  await sql`CREATE INDEX idx_products_price ON products (price) WHERE deleted_at IS NULL`.execute(db);

  // Busca parcial por nome (ILIKE '%termo%'): índice trigram, que o B-tree não atende.
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
  await sql`CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('products').execute();
}
