import { sql, type Kysely } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DeliveryPersonAvailability,
  DeliveryPersonId,
  Order,
  OrderStatus,
  Quantity,
} from '../../../../ordering/domain';
import {
  BURGER_ID,
  buildPlaceOrderParams,
  JUICE_ID,
  productSnapshot,
} from '../../../../ordering/domain/order/testing/order.fixture';
import type { OrderingDatabase } from '../../../../ordering/infra/persistence/schema/ordering-database';
import { insertDeliveryPerson, insertProduct } from '../../../../ordering/infra/persistence/testing/ordering-test-data';
import { KyselyOrderingUnitOfWork } from '../../../../ordering/infra/persistence/unit-of-work/kysely-ordering-unit-of-work';
import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import { InMemoryEventMediator } from '../../../../shared-kernel/infra/events/in-memory-event-mediator';
import { GetDeliveryTimeReportUseCase } from '../../../application/usecases/get-delivery-time-report/get-delivery-time-report.usecase';
import { GetOrdersByStatusReportUseCase } from '../../../application/usecases/get-orders-by-status-report/get-orders-by-status-report.usecase';
import { GetRevenueReportUseCase } from '../../../application/usecases/get-revenue-report/get-revenue-report.usecase';
import { GetTopProductsReportUseCase } from '../../../application/usecases/get-top-products-report/get-top-products-report.usecase';
import type { ReportingDatabase } from '../schema/reporting-database';
import { KyselyDeliveryTimeQuery } from './kysely-delivery-time.query';
import { KyselyOrdersByStatusQuery } from './kysely-orders-by-status.query';
import { KyselyRevenueQuery } from './kysely-revenue.query';
import { KyselyTopProductsQuery } from './kysely-top-products.query';

const db = connectToTestDatabase<ReportingDatabase>();
const raw = db as unknown as Kysely<unknown>;
const ordering = new KyselyOrderingUnitOfWork(
  db as unknown as Kysely<OrderingDatabase>,
  new InMemoryEventMediator(),
);

const revenue = new GetRevenueReportUseCase(new KyselyRevenueQuery(db));
const ordersByStatus = new GetOrdersByStatusReportUseCase(new KyselyOrdersByStatusQuery(db));
const topProducts = new GetTopProductsReportUseCase(new KyselyTopProductsQuery(db));
const deliveryTime = new GetDeliveryTimeReportUseCase(new KyselyDeliveryTimeQuery(db));

const MOTORCYCLE = 'b0000000-0000-4000-8000-000000000001';
const BICYCLE = 'b0000000-0000-4000-8000-000000000002';
const MINUTE = 60_000;

type Item = { productId: string; quantity: number };

/** Pedido criado em `createdAt`; se `deliveredAt`, percorre o fluxo até `delivered`. */
function order({
  createdAt,
  deliveredAt,
  courier = MOTORCYCLE,
  items = [
    { productId: BURGER_ID, quantity: 2 },
    { productId: JUICE_ID, quantity: 1 },
  ],
}: {
  createdAt: string;
  deliveredAt?: string;
  courier?: string;
  items?: Item[];
}): Order {
  const prices: Record<string, number> = { [BURGER_ID]: 32.9, [JUICE_ID]: 12.5 };
  const placed = Order.place(
    buildPlaceOrderParams({
      now: new Date(createdAt),
      items: items.map((item) => ({
        product: productSnapshot({ id: item.productId, price: prices[item.productId] ?? 10 }),
        quantity: Quantity.of(item.quantity),
      })),
    }),
  );
  if (deliveredAt === undefined) return placed;

  const at = new Date(createdAt);
  const availability = DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(courier),
    isActive: true,
    hasDeliveryInProgress: false,
  });
  placed.changeStatus(OrderStatus.of('preparing'), at);
  placed.changeStatus(OrderStatus.of('ready'), at);
  placed.assignDeliveryPerson(availability, at);
  placed.dispatch(availability, at);
  placed.changeStatus(OrderStatus.of('delivered'), new Date(deliveredAt));
  return placed;
}

async function save(...orders: Order[]): Promise<void> {
  await ordering.transaction(async ({ orders: repository }) => {
    for (const item of orders) await repository.save(item);
  });
}

describe('Consultas do Reporting no PostgreSQL', () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
    await insertDeliveryPerson(raw, { id: MOTORCYCLE, name: 'Moto', vehicleType: 'motorcycle' });
    await insertDeliveryPerson(raw, { id: BICYCLE, name: 'Bike', vehicleType: 'bicycle' });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('receita por período', () => {
    it('soma só pedidos entregues, pelo dia local da entrega em São Paulo', async () => {
      await save(
        // 31/01 02:30 UTC = 30/01 23:30 em São Paulo → conta em 30/01.
        order({ createdAt: '2025-01-30T20:00:00Z', deliveredAt: '2025-01-31T02:30:00Z' }),
        order({ createdAt: '2025-01-31T10:00:00Z', deliveredAt: '2025-01-31T12:00:00Z' }),
        order({ createdAt: '2025-01-31T11:00:00Z', deliveredAt: '2025-01-31T13:00:00Z' }),
        // Entregue em 01/02 local: fora do período.
        order({ createdAt: '2025-01-31T20:00:00Z', deliveredAt: '2025-02-01T03:00:00Z' }),
        // Criado no período, mas não entregue.
        order({ createdAt: '2025-01-31T12:00:00Z' }),
      );

      const report = await revenue.execute({ startDate: '2025-01-30', endDate: '2025-01-31' });

      expect(report).toEqual({
        startDate: '2025-01-30',
        endDate: '2025-01-31',
        totalRevenue: 234.9,
        totalOrders: 3,
        averageOrderValue: 78.3,
        dailyRevenue: [
          { date: '2025-01-30', revenue: 78.3, orders: 1 },
          { date: '2025-01-31', revenue: 156.6, orders: 2 },
        ],
      });
    });

    it('usa o total congelado no pedido, não o preço atual do produto', async () => {
      await save(order({ createdAt: '2025-01-31T10:00:00Z', deliveredAt: '2025-01-31T12:00:00Z' }));
      await sql`UPDATE products SET price = 99.90`.execute(db);

      const report = await revenue.execute({ startDate: '2025-01-31', endDate: '2025-01-31' });

      expect(report.totalRevenue).toBe(78.3);
    });
  });

  describe('pedidos por status', () => {
    it('conta pelo status atual, filtrando pela criação', async () => {
      await save(
        order({ createdAt: '2025-01-10T12:00:00Z' }),
        order({ createdAt: '2025-01-10T13:00:00Z' }),
        order({ createdAt: '2025-01-10T14:00:00Z', deliveredAt: '2025-01-10T15:00:00Z' }),
        order({ createdAt: '2025-02-10T12:00:00Z' }),
      );

      const all = await ordersByStatus.execute({});
      const january = await ordersByStatus.execute({ startDate: '2025-01-01', endDate: '2025-01-31' });

      expect(all.total).toBe(4);
      expect(january.data).toEqual([
        { status: 'pending', count: 2 },
        { status: 'preparing', count: 0 },
        { status: 'ready', count: 0 },
        { status: 'delivering', count: 0 },
        { status: 'delivered', count: 1 },
        { status: 'cancelled', count: 0 },
      ]);
    });
  });

  describe('produtos mais vendidos', () => {
    it('ranking por quantidade só com entregues, receita pelo preço do pedido e nome atual do Catalog', async () => {
      const cancelled = order({
        createdAt: '2025-01-10T09:00:00Z',
        items: [{ productId: JUICE_ID, quantity: 50 }],
      });
      cancelled.changeStatus(OrderStatus.of('cancelled'), new Date('2025-01-10T09:30:00Z'));
      await save(
        order({
          createdAt: '2025-01-10T10:00:00Z',
          deliveredAt: '2025-01-10T11:00:00Z',
          items: [{ productId: BURGER_ID, quantity: 3 }],
        }),
        order({
          createdAt: '2025-01-11T10:00:00Z',
          deliveredAt: '2025-01-11T11:00:00Z',
          items: [
            { productId: BURGER_ID, quantity: 1 },
            { productId: JUICE_ID, quantity: 2 },
          ],
        }),
        cancelled,
      );
      await sql`UPDATE products SET name = 'X-Burger Premium' WHERE id = ${BURGER_ID}`.execute(db);

      const report = await topProducts.execute({});

      expect(report.data).toEqual([
        { productId: BURGER_ID, productName: 'X-Burger Premium', totalQuantity: 4, totalRevenue: 131.6 },
        { productId: JUICE_ID, productName: 'Suco de Laranja', totalQuantity: 2, totalRevenue: 25 },
      ]);
    });

    it('respeita o limite e o período pela data da entrega', async () => {
      await save(
        order({
          createdAt: '2025-01-10T10:00:00Z',
          deliveredAt: '2025-01-10T11:00:00Z',
          items: [{ productId: BURGER_ID, quantity: 5 }],
        }),
        order({
          createdAt: '2025-02-10T10:00:00Z',
          deliveredAt: '2025-02-10T11:00:00Z',
          items: [{ productId: JUICE_ID, quantity: 9 }],
        }),
      );

      const february = await topProducts.execute({ startDate: '2025-02-01', endDate: '2025-02-28' });
      const top1 = await topProducts.execute({ limit: 1 });

      expect(february.data.map((product) => product.productName)).toEqual(['Suco de Laranja']);
      expect(top1.data.map((product) => product.productName)).toEqual(['Suco de Laranja']);
    });
  });

  describe('tempo médio de entrega', () => {
    it('mede criação → entrega e agrupa pelo veículo do entregador', async () => {
      const created = new Date('2025-01-10T10:00:00Z');
      const after = (minutes: number): string => new Date(created.getTime() + minutes * MINUTE).toISOString();
      await save(
        order({ createdAt: created.toISOString(), deliveredAt: after(30), courier: MOTORCYCLE }),
        order({ createdAt: created.toISOString(), deliveredAt: after(50), courier: MOTORCYCLE }),
        order({ createdAt: created.toISOString(), deliveredAt: after(20), courier: BICYCLE }),
        order({ createdAt: created.toISOString() }),
      );

      const report = await deliveryTime.execute({});

      expect(report).toEqual({
        // (30 + 50 + 20) / 3 = 33,3…
        averageMinutes: 33.3,
        fastestMinutes: 20,
        slowestMinutes: 50,
        totalDelivered: 3,
        byVehicleType: [
          { vehicleType: 'motorcycle', averageMinutes: 40, fastestMinutes: 30, slowestMinutes: 50, count: 2 },
          { vehicleType: 'bicycle', averageMinutes: 20, fastestMinutes: 20, slowestMinutes: 20, count: 1 },
        ],
      });
    });

    it('sem entregas no período: nulos', async () => {
      await save(order({ createdAt: '2025-01-10T10:00:00Z', deliveredAt: '2025-01-10T10:30:00Z' }));

      const report = await deliveryTime.execute({ startDate: '2025-03-01', endDate: '2025-03-31' });

      expect(report).toMatchObject({ averageMinutes: null, totalDelivered: 0, byVehicleType: [] });
    });
  });
});
