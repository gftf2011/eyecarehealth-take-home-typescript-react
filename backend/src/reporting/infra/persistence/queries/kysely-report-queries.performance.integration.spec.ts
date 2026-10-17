import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { BURGER_ID, JUICE_ID } from '../../../../ordering/domain/order/testing/order.fixture';
import { insertDeliveryPerson, insertProduct } from '../../../../ordering/infra/persistence/testing/ordering-test-data';
import { createPostgresPool } from '../../../../shared-kernel/infra/database/postgres';
import { resetDatabase } from '../../../../shared-kernel/infra/database/testing/test-database';
import { GetDeliveryTimeReportUseCase } from '../../../application/usecases/get-delivery-time-report/get-delivery-time-report.usecase';
import { GetOrdersByStatusReportUseCase } from '../../../application/usecases/get-orders-by-status-report/get-orders-by-status-report.usecase';
import { GetRevenueReportUseCase } from '../../../application/usecases/get-revenue-report/get-revenue-report.usecase';
import { GetTopProductsReportUseCase } from '../../../application/usecases/get-top-products-report/get-top-products-report.usecase';
import type { ReportingDatabase } from '../schema/reporting-database';
import { KyselyDeliveryTimeQuery } from './kysely-delivery-time.query';
import { KyselyOrdersByStatusQuery } from './kysely-orders-by-status.query';
import { KyselyRevenueQuery } from './kysely-revenue.query';
import { KyselyTopProductsQuery } from './kysely-top-products.query';

/** Mesmo orçamento das listagens: o painel de relatórios carrega os 4 juntos. */
const MAX_REPORT_RESPONSE_MS = 200;
const TOTAL_ORDERS = 10_200;
const COURIER_ID = 'b0000000-0000-4000-8000-000000000001';

/** Guarda o SQL executado, para rodar o EXPLAIN da consulta real. */
const executedQueries: CompiledQuery[] = [];
const db = new Kysely<ReportingDatabase>({
  dialect: new PostgresDialect({ pool: createPostgresPool(inject('databaseUrl')) }),
  log: (event) => {
    if (event.level === 'query') executedQueries.push(event.query);
  },
});

const revenue = new GetRevenueReportUseCase(new KyselyRevenueQuery(db));
const ordersByStatus = new GetOrdersByStatusReportUseCase(new KyselyOrdersByStatusQuery(db));
const topProducts = new GetTopProductsReportUseCase(new KyselyTopProductsQuery(db));
const deliveryTime = new GetDeliveryTimeReportUseCase(new KyselyDeliveryTimeQuery(db));

/** Mede o caso de uso e devolve o plano (EXPLAIN JSON) da última consulta executada. */
async function measure(run: () => Promise<unknown>): Promise<{ elapsedMs: number; plan: string }> {
  executedQueries.length = 0;
  const startedAt = performance.now();
  await run();
  const elapsedMs = performance.now() - startedAt;

  const query = executedQueries.at(-1);
  if (query === undefined) throw new Error('Nenhuma consulta registrada');
  const { rows } = await db.executeQuery<{ 'QUERY PLAN': unknown }>(
    CompiledQuery.raw(`EXPLAIN (FORMAT JSON) ${query.sql}`, [...query.parameters]),
  );
  return { elapsedMs, plan: JSON.stringify(rows[0]?.['QUERY PLAN']) };
}

describe(`Relatórios com ${TOTAL_ORDERS} pedidos no PostgreSQL`, () => {
  beforeAll(async () => {
    await resetDatabase(db);
    const raw = db as unknown as Kysely<unknown>;
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
    await insertDeliveryPerson(raw, { id: COURIER_ID });

    // Um pedido a cada ~51 min ao longo de 2025; 4 em cada 5 entregues (n % 5 <> 0).
    await sql`
      INSERT INTO orders (
        id, customer_name, customer_phone, delivery_address, latitude, longitude,
        status, total_amount, delivery_person_id, created_at, updated_at
      )
      SELECT
        ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
        'Cliente ' || n, '(11) 99999-' || lpad((n % 10000)::text, 4, '0'),
        'Rua de Teste, ' || n || ', São Paulo - SP', -23.55, -46.63,
        CASE WHEN n % 5 = 0 THEN 'pending' ELSE 'delivered' END,
        32.90 * (n % 3 + 1) + 12.50,
        CASE WHEN n % 5 = 0 THEN NULL ELSE ${COURIER_ID}::uuid END,
        timestamptz '2025-01-01 03:00:00+00' + n * interval '51 minutes',
        timestamptz '2025-01-01 03:00:00+00' + n * interval '51 minutes'
      FROM generate_series(0, ${TOTAL_ORDERS - 1}) AS n
    `.execute(db);
    await sql`
      INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price)
      SELECT gen_random_uuid(), o.id, p.id, p.name, 1, p.price
      FROM orders o CROSS JOIN products p
    `.execute(db);
    await sql`
      INSERT INTO order_status_history (order_id, position, from_status, to_status, changed_at)
      SELECT id, 0, NULL, 'pending', created_at FROM orders
      UNION ALL
      SELECT id, 1, 'delivering', 'delivered', created_at + interval '35 minutes'
      FROM orders WHERE status = 'delivered'
    `.execute(db);
    await sql`VACUUM ANALYZE orders, order_items, order_status_history`.execute(db);

    // Aquece conexão e cache de planos.
    await revenue.execute({ startDate: '2025-03-01', endDate: '2025-03-31' });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await db.destroy();
  });

  it('receita de um mês usa o índice do histórico e responde em < 200ms', async () => {
    const { elapsedMs, plan } = await measure(() =>
      revenue.execute({ startDate: '2025-03-01', endDate: '2025-03-31' }),
    );

    expect(plan).toContain('"Index Name":"idx_order_status_history_to_changed"');
    expect(elapsedMs).toBeLessThan(MAX_REPORT_RESPONSE_MS);
  });

  it('produtos mais vendidos de um mês usam o índice do histórico e respondem em < 200ms', async () => {
    const { elapsedMs, plan } = await measure(() =>
      topProducts.execute({ startDate: '2025-03-01', endDate: '2025-03-31' }),
    );

    expect(plan).toContain('"Index Name":"idx_order_status_history_to_changed"');
    expect(elapsedMs).toBeLessThan(MAX_REPORT_RESPONSE_MS);
  });

  it.each([
    ['receita do ano inteiro (366 pontos)', () => revenue.execute({ startDate: '2025-01-01', endDate: '2025-12-31' })],
    ['pedidos por status (tudo)', () => ordersByStatus.execute({})],
    ['produtos mais vendidos (tudo)', () => topProducts.execute({})],
    ['tempo médio de entrega (tudo)', () => deliveryTime.execute({})],
  ])('%s: responde em < 200ms', async (_scenario, run) => {
    const { elapsedMs } = await measure(run);
    expect(elapsedMs).toBeLessThan(MAX_REPORT_RESPONSE_MS);
  });
});
