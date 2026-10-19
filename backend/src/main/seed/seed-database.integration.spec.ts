import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { PasswordHash } from '../../identity/domain';
import { BcryptPasswordHasher } from '../../identity/infra/security/bcrypt-password.hasher';
import { GetDeliveryTimeReportUseCase } from '../../reporting/application/usecases/get-delivery-time-report/get-delivery-time-report.usecase';
import { GetRevenueReportUseCase } from '../../reporting/application/usecases/get-revenue-report/get-revenue-report.usecase';
import { KyselyDeliveryTimeQuery } from '../../reporting/infra/persistence/queries/kysely-delivery-time.query';
import { KyselyRevenueQuery } from '../../reporting/infra/persistence/queries/kysely-revenue.query';
import type { ReportingDatabase } from '../../reporting/infra/persistence/schema/reporting-database';
import { createKysely, createPostgresPool } from '../../shared-kernel/infra/database/postgres';
import { truncateApplicationTables } from '../../shared-kernel/infra/database/truncate-application-tables';
import { parseSeedData, type SeedData } from './seed-data';
import { seedDatabase } from './seed-database';

const SEED_FILE = fileURLToPath(new URL('../../../../seed/data.json', import.meta.url));
/** Quarta-feira, 15h em São Paulo. */
const NOW = new Date('2025-06-11T18:00:00Z');

const pool = createPostgresPool(inject('databaseUrl'));
const db = createKysely<unknown>(pool);
let data: SeedData;

async function count(table: string): Promise<number> {
  const { rows } = await sql<{ total: string }>`SELECT count(*) AS total FROM ${sql.table(table)}`.execute(db);
  return Number(rows[0]?.total);
}

describe('seed com seed/data.json', () => {
  beforeAll(async () => {
    data = parseSeedData(JSON.parse(await readFile(SEED_FILE, 'utf8')));
  });

  beforeEach(async () => {
    await truncateApplicationTables(db);
  });

  afterAll(async () => {
    await truncateApplicationTables(db);
    await pool.end();
  });

  const seed = (reset = false) => seedDatabase({ pool, data, now: NOW, reset, bcryptCost: 10 });

  it('popula tudo pelos casos de uso, com as contagens do arquivo', async () => {
    const result = await seed();

    expect(result).toEqual({
      status: 'seeded',
      summary: { users: 3, products: 15, deliveryPersons: 6, orders: 12 },
    });
    expect([
      await count('users'),
      await count('products'),
      await count('delivery_persons'),
      await count('orders'),
    ]).toEqual([3, 15, 6, 12]);
  });

  it('cada pedido termina no status do arquivo, com o entregador indicado e histórico completo', async () => {
    await seed();

    const { rows } = await sql<{ status: string; courier: string | null; transitions: number }>`
      SELECT o.status, d.name AS courier, count(h.*)::int AS transitions
      FROM orders o
      LEFT JOIN delivery_persons d ON d.id = o.delivery_person_id
      JOIN order_status_history h ON h.order_id = o.id
      GROUP BY o.id, o.status, d.name, o.created_at
      ORDER BY o.created_at
    `.execute(db);

    const expected = data.orders.map((order) => ({
      status: order.status,
      courier: order.deliveryPersonIndex === undefined ? null : data.deliveryPersons[order.deliveryPersonIndex]?.name,
    }));
    expect(rows.map(({ status, courier }) => ({ status, courier })).sort(byStatusAndCourier)).toEqual(
      expected.sort(byStatusAndCourier),
    );
    // pending: 1 transição; delivered: pending → preparing → ready → delivering → delivered.
    expect(rows.filter((row) => row.status === 'delivered').every((row) => row.transitions === 5)).toBe(true);
  });

  it('respeita indisponibilidade, inatividade e a senha em bcrypt do arquivo', async () => {
    await seed();

    const unavailable = await sql<{ name: string }>`SELECT name FROM products WHERE NOT is_available`.execute(db);
    const inactive = await sql<{ name: string }>`SELECT name FROM delivery_persons WHERE NOT is_active`.execute(db);
    const admin = await sql<{ password_hash: string }>`
      SELECT password_hash FROM users WHERE email = 'admin@fastmeals.com'
    `.execute(db);

    expect(unavailable.rows.map((row) => row.name)).toEqual(['Wrap de Carne Seca']);
    expect(inactive.rows.map((row) => row.name)).toEqual(['Pedro Oliveira']);
    const hash = admin.rows[0]?.password_hash ?? '';
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await new BcryptPasswordHasher(10).verify('Admin@123', PasswordHash.fromHash(hash))).toBe(true);
  });

  it('gera horários plausíveis: os relatórios saem com dados', async () => {
    await seed();
    const reporting = db as unknown as Kysely<ReportingDatabase>;

    const revenue = await new GetRevenueReportUseCase(new KyselyRevenueQuery(reporting)).execute({
      startDate: '2025-05-28',
      endDate: '2025-06-11',
    });
    const deliveryTime = await new GetDeliveryTimeReportUseCase(new KyselyDeliveryTimeQuery(reporting)).execute({});

    expect(revenue.totalOrders).toBe(4);
    expect(revenue.totalRevenue).toBeGreaterThan(0);
    expect(revenue.dailyRevenue.filter((day) => day.orders > 0).length).toBeGreaterThan(1);
    expect(deliveryTime.totalDelivered).toBe(4);
    expect(deliveryTime.averageMinutes).toBeGreaterThanOrEqual(29);
    expect(deliveryTime.averageMinutes).toBeLessThanOrEqual(83);
    // Nada no futuro: todos os horários antes do "agora" do seed.
    const future = await sql<{ total: string }>`
      SELECT count(*) AS total FROM order_status_history WHERE changed_at > ${NOW}
    `.execute(db);
    expect(Number(future.rows[0]?.total)).toBe(0);
  });

  it('o usuário courier entra como o entregador indicado no arquivo', async () => {
    await seed();

    const { rows } = await sql<{ email: string; role: string; courier: string }>`
      SELECT u.email, u.role, d.name AS courier
      FROM delivery_persons d JOIN users u ON u.id = d.user_id
    `.execute(db);

    const linked = data.users.filter((user) => user.deliveryPersonIndex !== undefined);
    expect(rows).toEqual(
      linked.map((user) => ({
        email: user.email,
        role: 'courier',
        courier: data.deliveryPersons[user.deliveryPersonIndex ?? -1]?.name,
      })),
    );
  });

  it('é idempotente: com dados presentes, não altera nada; --reset recria', async () => {
    await seed();

    expect(await seed()).toEqual({ status: 'skipped' });
    expect(await count('orders')).toBe(12);

    expect((await seed(true)).status).toBe('seeded');
    expect([await count('users'), await count('orders')]).toEqual([3, 12]);
  });
});

function byStatusAndCourier(
  a: { status: string; courier: string | null | undefined },
  b: { status: string; courier: string | null | undefined },
): number {
  return `${a.status}|${a.courier ?? ''}`.localeCompare(`${b.status}|${b.courier ?? ''}`);
}
