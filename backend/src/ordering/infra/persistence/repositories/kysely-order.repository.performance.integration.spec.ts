import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createPostgresPool } from '../../../../shared-kernel/infra/database/postgres';
import { resetDatabase } from '../../../../shared-kernel/infra/database/testing/test-database';
import { InMemoryEventMediator } from '../../../../shared-kernel/infra/events/in-memory-event-mediator';
import {
  ListOrdersUseCase,
  type ListOrdersInput,
} from '../../../application/usecases/list-orders/list-orders.usecase';
import { BURGER_ID, COURIER_ID, JUICE_ID } from '../../../domain/order/testing/order.fixture';
import type { OrderingDatabase } from '../schema/ordering-database';
import { insertDeliveryPerson, insertProduct } from '../testing/ordering-test-data';
import { KyselyOrderingUnitOfWork } from '../unit-of-work/kysely-ordering-unit-of-work';

/** Requisito não funcional do enunciado. */
const MAX_LIST_RESPONSE_MS = 200;

const TOTAL_ORDERS = 10_200;
/** Status por n % 5; `pending` quando n % 5 = 0: 2.040 pedidos. */
const PENDING_ORDERS = 2_040;
/** Um pedido por minuto a partir de 01/01 00:00 em São Paulo: 1.440 no dia 02/01. */
const ORDERS_ON_JAN_2 = 1_440;

/** Guarda o SQL de cada consulta executada, para rodar o EXPLAIN do SQL real. */
const executedQueries: CompiledQuery[] = [];
const db = new Kysely<OrderingDatabase>({
  dialect: new PostgresDialect({ pool: createPostgresPool(inject('databaseUrl')) }),
  log: (event) => {
    if (event.level === 'query') executedQueries.push(event.query);
  },
});
const listOrders = new ListOrdersUseCase(new KyselyOrderingUnitOfWork(db, new InMemoryEventMediator()));

type Measured = {
  elapsedMs: number;
  total: number;
  /** Plano escolhido pelo PostgreSQL para a consulta de página de `orders` (EXPLAIN JSON). */
  plan: string;
};

/**
 * Mede o caso de uso inteiro (página, total, itens, histórico e entregadores)
 * e devolve o plano da consulta de página.
 */
async function measureList(input: ListOrdersInput): Promise<Measured> {
  executedQueries.length = 0;

  const startedAt = performance.now();
  const page = await listOrders.execute(input);
  const elapsedMs = performance.now() - startedAt;

  const pageQuery = executedQueries.find(
    (query) => /from "orders"/i.test(query.sql) && /\blimit\b/i.test(query.sql),
  );
  if (pageQuery === undefined) throw new Error('Consulta paginada não encontrada no log');

  const { rows } = await db.executeQuery<{ 'QUERY PLAN': unknown }>(
    CompiledQuery.raw(`EXPLAIN (FORMAT JSON) ${pageQuery.sql}`, [...pageQuery.parameters]),
  );
  return { elapsedMs, total: page.pagination.total, plan: JSON.stringify(rows[0]?.['QUERY PLAN']) };
}

describe(`ListOrders com ${TOTAL_ORDERS} pedidos no PostgreSQL`, () => {
  beforeAll(async () => {
    await resetDatabase(db);
    const raw = db as unknown as Kysely<unknown>;
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
    await insertDeliveryPerson(raw, { id: COURIER_ID, name: 'Carlos Santos' });

    // Status sem `delivering` (o índice único permite só uma entrega por entregador).
    await sql`
      INSERT INTO orders (
        id, customer_name, customer_phone, delivery_address, latitude, longitude,
        status, total_amount, delivery_person_id, created_at, updated_at
      )
      SELECT
        ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
        'Cliente ' || n,
        '(11) 99999-' || lpad((n % 10000)::text, 4, '0'),
        'Rua de Teste, ' || n || ', São Paulo - SP',
        -23.5 - (n % 100) / 1000.0,
        -46.6 - (n % 100) / 1000.0,
        (ARRAY['pending', 'preparing', 'ready', 'delivered', 'cancelled'])[n % 5 + 1],
        32.90 * (n % 7 + 1) + 12.50,
        CASE WHEN n % 5 = 3 THEN ${COURIER_ID}::uuid END,
        timestamptz '2025-01-01 03:00:00+00' + n * interval '1 minute',
        timestamptz '2025-01-01 03:00:00+00' + n * interval '1 minute'
      FROM generate_series(0, ${TOTAL_ORDERS - 1}) AS n
    `.execute(db);
    await sql`
      INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price)
      SELECT gen_random_uuid(), o.id, p.id, p.name,
             CASE WHEN p.id = ${BURGER_ID}::uuid THEN (substr(o.customer_name, 9)::int % 7 + 1) ELSE 1 END,
             p.price
      FROM orders o CROSS JOIN products p
    `.execute(db);
    await sql`
      INSERT INTO order_status_history (order_id, position, from_status, to_status, changed_at)
      SELECT id, 0, NULL, 'pending', created_at FROM orders
    `.execute(db);
    await sql`VACUUM ANALYZE orders, order_items, order_status_history`.execute(db);

    // Aquece conexão e cache de planos: a primeira consulta não representa o regime.
    await listOrders.execute({});
  });

  afterAll(async () => {
    await resetDatabase(db);
    await db.destroy();
  });

  it.each([
    ['mais recentes primeiro (padrão)', {}, 'idx_orders_created_at', TOTAL_ORDERS],
    ['mais antigos primeiro', { sortOrder: 'asc' }, 'idx_orders_created_at', TOTAL_ORDERS],
    ['filtro por status', { status: 'pending' }, 'idx_orders_status_created', PENDING_ORDERS],
    [
      'ordenado por valor',
      { sortBy: 'totalAmount', sortOrder: 'asc' },
      'idx_orders_total_amount',
      TOTAL_ORDERS,
    ],
    [
      'filtro por dia de criação',
      { startDate: '2025-01-02', endDate: '2025-01-02' },
      'idx_orders_created_at',
      ORDERS_ON_JAN_2,
    ],
  ] satisfies [string, ListOrdersInput, string, number][])(
    '%s: responde em < 200ms usando o índice esperado',
    async (_scenario, input, expectedIndex, expectedTotal) => {
      const { elapsedMs, total, plan } = await measureList(input);

      expect(total).toBe(expectedTotal);
      expect(plan).toContain(`"Index Name":"${expectedIndex}"`);
      expect(plan).not.toContain('Seq Scan');
      expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
    },
  );

  it.each([
    ['página profunda', { page: 510, limit: 20 }],
    ['página de 100 itens com entregadores', { status: 'delivered', limit: 100 }],
    ['status + ordenação por valor', { status: 'ready', sortBy: 'totalAmount' }],
  ] satisfies [string, ListOrdersInput][])('%s: responde em < 200ms', async (_scenario, input) => {
    const { elapsedMs } = await measureList(input);
    expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
  });
});
