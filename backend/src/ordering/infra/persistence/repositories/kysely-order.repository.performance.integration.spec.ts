import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createPostgresPool } from '../../../../shared-kernel/infra/database/postgres';
import { resetDatabase } from '../../../../shared-kernel/infra/database/testing/test-database';
import { encodeCursor } from '../../../../shared-kernel/application/pagination/cursor';
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
const PAGE = 20;

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
  count: number;
  /** Plano escolhido pelo PostgreSQL para a consulta de página de `orders` (EXPLAIN JSON). */
  plan: string;
};

/**
 * Mede o caso de uso inteiro (página, itens, histórico e entregadores)
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
  return { elapsedMs, count: page.data.length, plan: JSON.stringify(rows[0]?.['QUERY PLAN']) };
}

describe(`ListOrders com ${TOTAL_ORDERS} pedidos no PostgreSQL`, () => {
  let deepCursor: string;

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

    // O cursor da última página (a que o OFFSET 10.180 pagaria lendo tudo antes dela).
    const deep = await sql<{ created_at: Date; id: string }>`
      SELECT created_at, id FROM orders ORDER BY created_at DESC, id DESC OFFSET ${TOTAL_ORDERS - PAGE - 1} LIMIT 1
    `.execute(db);
    const row = deep.rows[0];
    if (row === undefined) throw new Error('Linha do cursor profundo não encontrada');
    deepCursor = encodeCursor(
      { field: 'createdAt', direction: 'desc' },
      { direction: 'after', value: row.created_at.getTime(), id: row.id },
    );
  });

  afterAll(async () => {
    await resetDatabase(db);
    await db.destroy();
  });

  it.each([
    ['mais recentes primeiro (padrão)', {}, 'idx_orders_created_at'],
    ['mais antigos primeiro', { sortOrder: 'asc' }, 'idx_orders_created_at'],
    ['filtro por status', { status: 'pending' }, 'idx_orders_status_created'],
    [
      'ordenado por valor',
      { sortBy: 'totalAmount', sortOrder: 'asc' },
      'idx_orders_total_amount',
    ],
    [
      'filtro por dia de criação',
      { startDate: '2025-01-02', endDate: '2025-01-02' },
      'idx_orders_created_at',
    ],
    ['status + ordenação por valor', { status: 'ready', sortBy: 'totalAmount' }, 'idx_orders_status_total'],
  ] satisfies [string, ListOrdersInput, string][])(
    '%s: responde em < 200ms usando o índice esperado',
    async (_scenario, input, expectedIndex) => {
      const { elapsedMs, count, plan } = await measureList(input);

      expect(count).toBe(PAGE);
      expect(plan).toContain(`"Index Name":"${expectedIndex}"`);
      expect(plan).not.toContain('Seq Scan');
      expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
    },
  );

  it('última página por cursor: continua pelo índice, sem ler as linhas anteriores', async () => {
    const { elapsedMs, count, plan } = await measureList({ cursor: deepCursor });

    expect(count).toBe(PAGE);
    expect(plan).toContain('"Index Name":"idx_orders_created_at"');
    expect(plan).not.toContain('Seq Scan');
    expect(plan).not.toContain('"Node Type":"Sort"');
    expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
  });

  it('página de 100 itens com entregadores: responde em < 200ms', async () => {
    const { elapsedMs, count } = await measureList({ status: 'delivered', limit: 100 });

    expect(count).toBe(100);
    expect(elapsedMs).toBeLessThan(MAX_LIST_RESPONSE_MS);
  });
});
