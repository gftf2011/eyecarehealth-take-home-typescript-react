import { sql, type Kysely } from 'kysely';

const ORDER_STATUSES = sql`('pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled')`;

/**
 * Agregado Order: `orders` (raiz), `order_items` e `order_status_history`
 * nascem juntos porque são sempre gravados juntos.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('customer_name', 'varchar(100)', (col) =>
      col.notNull().check(sql`char_length(customer_name) between 3 and 100`),
    )
    .addColumn('customer_phone', 'varchar(20)', (col) =>
      col.notNull().check(sql`customer_phone ~ '^\\(\\d{2}\\) \\d{5}-\\d{4}$'`),
    )
    .addColumn('delivery_address', 'varchar(300)', (col) =>
      col.notNull().check(sql`char_length(delivery_address) between 10 and 300`),
    )
    .addColumn('latitude', 'numeric(10, 8)', (col) => col.notNull().check(sql`latitude between -90 and 90`))
    .addColumn('longitude', 'numeric(11, 8)', (col) =>
      col.notNull().check(sql`longitude between -180 and 180`),
    )
    .addColumn('status', 'varchar(20)', (col) => col.notNull().check(sql`status in ${ORDER_STATUSES}`))
    // Derivado dos itens pelo agregado; persistido para ordenar/paginar por índice.
    .addColumn('total_amount', 'numeric(10, 2)', (col) => col.notNull().check(sql`total_amount > 0`))
    .addColumn('delivery_person_id', 'uuid', (col) => col.references('delivery_persons.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    // Despachado ou entregue sempre tem entregador (mesma regra do agregado).
    .addCheckConstraint(
      'orders_dispatched_has_delivery_person',
      sql`status not in ('delivering', 'delivered') or delivery_person_id is not null`,
    )
    .execute();

  await sql`
    CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  // Listagem: ordenação padrão, ordenação por valor e filtro por status (com período).
  // O desempate pelo ID segue a direção da ordenação, então cada índice serve
  // para `asc` (varredura reversa) e `desc` (varredura direta).
  await sql`CREATE INDEX idx_orders_created_at ON orders (created_at DESC, id DESC)`.execute(db);
  await sql`CREATE INDEX idx_orders_total_amount ON orders (total_amount DESC, id DESC)`.execute(db);
  await sql`CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC, id DESC)`.execute(db);
  // FK não é indexada automaticamente no PostgreSQL.
  await sql`CREATE INDEX idx_orders_delivery_person_id ON orders (delivery_person_id)`.execute(db);
  // Defesa em profundidade: um entregador nunca tem duas entregas em andamento.
  await sql`
    CREATE UNIQUE INDEX uq_orders_one_delivery_per_person
    ON orders (delivery_person_id) WHERE status = 'delivering'
  `.execute(db);

  await db.schema
    .createTable('order_items')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    // Produtos usam soft delete: pedidos antigos continuam válidos.
    .addColumn('product_id', 'uuid', (col) => col.notNull().references('products.id'))
    // Snapshot do nome: o pedido mostra o produto como era na compra.
    .addColumn('product_name', 'varchar(120)', (col) => col.notNull())
    .addColumn('quantity', 'integer', (col) => col.notNull().check(sql`quantity > 0`))
    // Snapshot do preço no momento do pedido.
    .addColumn('unit_price', 'numeric(10, 2)', (col) => col.notNull().check(sql`unit_price > 0`))
    // O agregado une linhas do mesmo produto.
    .addUniqueConstraint('uq_order_items_order_product', ['order_id', 'product_id'])
    .execute();

  // O índice único (order_id, product_id) já atende a busca dos itens por pedido.
  await sql`CREATE INDEX idx_order_items_product_id ON order_items (product_id)`.execute(db);

  await db.schema
    .createTable('order_status_history')
    .addColumn('order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    // Posição da transição no histórico (0 = criação): idempotência ao salvar.
    .addColumn('position', 'smallint', (col) => col.notNull().check(sql`position >= 0`))
    .addColumn('from_status', 'varchar(20)', (col) => col.check(sql`from_status in ${ORDER_STATUSES}`))
    .addColumn('to_status', 'varchar(20)', (col) => col.notNull().check(sql`to_status in ${ORDER_STATUSES}`))
    .addColumn('changed_at', 'timestamptz', (col) => col.notNull())
    .addPrimaryKeyConstraint('pk_order_status_history', ['order_id', 'position'])
    // Só a criação não tem status de origem.
    .addCheckConstraint(
      'order_status_history_origin',
      sql`(position = 0) = (from_status is null)`,
    )
    .execute();

  // Relatórios de receita e de tempo de entrega: transições para `delivered` por período.
  await sql`CREATE INDEX idx_order_status_history_to_changed ON order_status_history (to_status, changed_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('order_status_history').execute();
  await db.schema.dropTable('order_items').execute();
  await db.schema.dropTable('orders').execute();
}
