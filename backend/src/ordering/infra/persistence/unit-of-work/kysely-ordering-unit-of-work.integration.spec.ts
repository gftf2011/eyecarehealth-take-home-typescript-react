import { sql, type Kysely } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { RemoveProductUseCase } from '../../../../catalog/application/usecases/remove-product/remove-product.usecase';
import { ProductInUseError } from '../../../../catalog/domain';
import type { CatalogDatabase } from '../../../../catalog/infra/persistence/schema/catalog-database';
import { KyselyCatalogUnitOfWork } from '../../../../catalog/infra/persistence/unit-of-work/kysely-catalog-unit-of-work';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import { startBlocked } from '../../../../shared-kernel/infra/database/testing/start-blocked';
import { InMemoryEventMediator } from '../../../../shared-kernel/infra/events/in-memory-event-mediator';
import { ChangeOrderStatusUseCase } from '../../../application/usecases/change-order-status/change-order-status.usecase';
import { ListOrdersUseCase } from '../../../application/usecases/list-orders/list-orders.usecase';
import { PlaceOrderUseCase } from '../../../application/usecases/place-order/place-order.usecase';
import {
  DeliveryPersonId,
  DeliveryPersonUnavailableError,
  InvalidStatusTransitionError,
  OrderStatus,
  ProductId,
  Quantity,
  type Order,
} from '../../../domain';
import {
  availableCourier,
  BURGER_ID,
  buildOrder,
  buildOrderIn,
  COURIER_ID,
  JUICE_ID,
  LATER,
  productSnapshot,
} from '../../../domain/order/testing/order.fixture';
import { RecordingOrderingMetrics } from '../../../application/testing/recording-ordering-metrics';
import { subscribeOrderingEventHandlers } from '../../../main/ordering-event-handlers';
import type { OrderingDatabase } from '../schema/ordering-database';
import { insertDeliveryPerson, insertProduct } from '../testing/ordering-test-data';
import { KyselyOrderingUnitOfWork } from './kysely-ordering-unit-of-work';

const db = connectToTestDatabase<OrderingDatabase>();
const raw = db as unknown as Kysely<unknown>;
const mediator = new InMemoryEventMediator();
subscribeOrderingEventHandlers(mediator, new RecordingOrderingMetrics());
const unitOfWork = new KyselyOrderingUnitOfWork(db, mediator);
const NOW = new Date('2025-01-20T16:00:00Z');
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

async function save(...orders: Order[]): Promise<void> {
  await unitOfWork.transaction(async ({ orders: repository }) => {
    for (const order of orders) await repository.save(order);
  });
}

async function find(order: Order): Promise<Order | null> {
  return unitOfWork.transaction(({ orders }) => orders.findById(order.id));
}

/** Pedido `ready` com o entregador informado já atribuído (sem eventos pendentes). */
function readyOrderAssignedTo(courierId: string): Order {
  const order = buildOrderIn('ready');
  order.assignDeliveryPerson(availableCourier(courierId), LATER);
  order.pullDomainEvents();
  return order;
}

describe('KyselyOrderingUnitOfWork', () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await insertProduct(raw, { id: BURGER_ID, name: 'X-Burger Especial', price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
    await insertDeliveryPerson(raw, { id: COURIER_ID, name: 'Carlos Santos' });
    await insertDeliveryPerson(raw, { id: OTHER_COURIER_ID, name: 'Ana Lima' });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('repositório', () => {
    it('persiste e reidrata o agregado inteiro: itens, histórico e entregador', async () => {
      const order = buildOrderIn('delivered');

      await save(order);

      expect((await find(order))?.snapshot()).toEqual(order.snapshot());
    });

    it('grava o total derivado dos itens e o snapshot de nome e preço', async () => {
      const order = buildOrder();
      await save(order);

      const row = await db.selectFrom('orders').select('total_amount').executeTakeFirstOrThrow();
      const items = await db
        .selectFrom('order_items')
        .select(['product_name', 'unit_price', 'quantity'])
        .orderBy('product_name')
        .execute();
      expect(row.total_amount).toBe('78.30');
      expect(items).toEqual([
        { product_name: 'Suco de Laranja', unit_price: '12.50', quantity: 1 },
        { product_name: 'X-Burger Especial', unit_price: '32.90', quantity: 2 },
      ]);
    });

    it('salvar de novo só acrescenta as transições novas (idempotente)', async () => {
      const order = buildOrder();
      await save(order);
      await save(order);

      order.changeStatus(OrderStatus.of('preparing'), LATER);
      await save(order);

      const history = await db
        .selectFrom('order_status_history')
        .select(['position', 'from_status', 'to_status'])
        .orderBy('position')
        .execute();
      expect(history).toEqual([
        { position: 0, from_status: null, to_status: 'pending' },
        { position: 1, from_status: 'pending', to_status: 'preparing' },
      ]);
      expect(await db.selectFrom('order_items').select('id').execute()).toHaveLength(2);
    });

    it('lista com filtro, ordenação e paginação, carregando itens e histórico de cada pedido', async () => {
      const at = (iso: string, price: number): Order =>
        buildOrder({
          now: new Date(iso),
          items: [{ product: productSnapshot({ price }), quantity: Quantity.of(1) }],
        });
      const cheap = at('2025-01-20T10:00:00Z', 10);
      const expensive = at('2025-01-20T11:00:00Z', 90);
      const middle = at('2025-01-20T12:00:00Z', 50);
      const cancelled = at('2025-01-20T13:00:00Z', 70);
      cancelled.changeStatus(OrderStatus.of('cancelled'), LATER);
      await save(cheap, expensive, middle, cancelled);

      const page = await unitOfWork.transaction(({ orders }) =>
        orders.list({
          offset: 0,
          limit: 2,
          status: 'pending',
          createdAt: { from: new Date('2025-01-20T00:00:00Z'), to: null },
          sort: { field: 'totalAmount', direction: 'desc' },
        }),
      );

      expect(page.total).toBe(3);
      expect(page.items.map((order) => order.id.value)).toEqual([expensive.id.value, middle.id.value]);
      expect(page.items[0]?.items).toHaveLength(1);
      expect(page.items[0]?.statusHistory).toHaveLength(1);
    });

    it('findById e findByIdForUpdate devolvem null para pedido inexistente', async () => {
      const missing = buildOrder();
      const [plain, locked] = await unitOfWork.transaction(async ({ orders }) => [
        await orders.findById(missing.id),
        await orders.findByIdForUpdate(missing.id),
      ]);
      expect(plain).toBeNull();
      expect(locked).toBeNull();
    });
  });

  describe('ACL do Catalog', () => {
    it('devolve nome, preço e disponibilidade; ignora produtos removidos', async () => {
      const unavailableId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
      const removedId = '6e5d4c3b-2a1f-4e0d-9c8b-7a6f5e4d3c2b';
      await insertProduct(raw, { id: unavailableId, name: 'Pudim', price: '9.00', isAvailable: false });
      await insertProduct(raw, { id: removedId, name: 'Antigo', removed: true });

      const snapshots = await unitOfWork.transaction(({ products }) =>
        products.snapshotsOf([BURGER_ID, unavailableId, removedId].map((id) => ProductId.from(id))),
      );

      expect(
        snapshots
          .map((snapshot) => [snapshot.name, snapshot.unitPrice.toDecimal(), snapshot.isAvailable] as const)
          .sort(([a], [b]) => a.localeCompare(b)),
      ).toEqual([
        ['Pudim', 9, false],
        ['X-Burger Especial', 32.9, true],
      ]);
    });

    it('PlaceOrder usa o preço vigente no banco e grava a atualização no outbox', async () => {
      const placed = await new PlaceOrderUseCase(unitOfWork, new FixedClock(NOW)).execute({
        customerName: 'Maria Oliveira',
        customerPhone: '(21) 98765-4321',
        deliveryAddress: 'Av. Brasil, 456, Rio de Janeiro - RJ',
        latitude: -22.9068,
        longitude: -43.1729,
        items: [{ productId: BURGER_ID, quantity: 3 }],
      });

      expect(placed.totalAmount).toBe(98.7);
      const outbox = await db.selectFrom('outbox_events').select(['event_name', 'payload']).execute();
      expect(outbox).toEqual([
        {
          event_name: 'ordering.order-updates',
          payload: expect.objectContaining({ type: 'order.placed', orderId: placed.id, totalAmount: 98.7 }),
        },
      ]);
    });
  });

  describe('ACL do Delivery', () => {
    it('informa disponibilidade: livre, ocupado, inativo e removido', async () => {
      const inactiveId = '7f6e5d4c-3b2a-4f1e-8d9c-0b1a2c3d4e5f';
      const removedId = '8a7f6e5d-4c3b-4a2f-9e1d-1c2b3a4d5e6f';
      await insertDeliveryPerson(raw, { id: inactiveId, isActive: false });
      await insertDeliveryPerson(raw, { id: removedId, removed: true });
      await save(buildOrderIn('delivering')); // COURIER_ID em entrega

      const availability = await unitOfWork.transaction(async ({ deliveryPersons }) => ({
        busy: await deliveryPersons.availabilityOf(DeliveryPersonId.from(COURIER_ID)),
        free: await deliveryPersons.availabilityOf(DeliveryPersonId.from(OTHER_COURIER_ID)),
        inactive: await deliveryPersons.availabilityOf(DeliveryPersonId.from(inactiveId)),
        removed: await deliveryPersons.availabilityOf(DeliveryPersonId.from(removedId)),
      }));

      expect(availability.busy).toMatchObject({ isActive: true, hasDeliveryInProgress: true });
      expect(availability.free).toMatchObject({ isActive: true, hasDeliveryInProgress: false });
      expect(availability.inactive).toMatchObject({ isActive: false, canTakeOrder: false });
      expect(availability.removed).toBeNull();
    });

    it('resume entregadores em lote, incluindo removidos', async () => {
      const removedId = '8a7f6e5d-4c3b-4a2f-9e1d-1c2b3a4d5e6f';
      await insertDeliveryPerson(raw, { id: removedId, name: 'Ex Entregador', removed: true });

      const summaries = await unitOfWork.transaction(({ deliveryPersons }) =>
        deliveryPersons.summariesOf([COURIER_ID, removedId].map((id) => DeliveryPersonId.from(id))),
      );

      expect([...summaries].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
        { id: COURIER_ID, name: 'Carlos Santos' },
        { id: removedId, name: 'Ex Entregador' },
      ]);
    });

    it('ListOrders traz o entregador de cada pedido', async () => {
      await save(buildOrderIn('delivered'), buildOrder());

      const page = await new ListOrdersUseCase(unitOfWork).execute({});

      expect(page.data.map((order) => order.deliveryPerson)).toEqual(
        expect.arrayContaining([null, { id: COURIER_ID, name: 'Carlos Santos' }]),
      );
    });
  });

  describe('concorrência', () => {
    it('duas alterações simultâneas do mesmo pedido são serializadas (sem lost update)', async () => {
      const order = buildOrder();
      await save(order);
      const changeStatus = new ChangeOrderStatusUseCase(unitOfWork, new FixedClock(NOW));

      const blocked = await unitOfWork.transaction(async ({ orders }) => {
        const locked = await orders.findByIdForUpdate(order.id);
        const waiting = await startBlocked(() =>
          changeStatus.execute({ id: order.id.value, status: 'cancelled' }),
        );
        locked?.changeStatus(OrderStatus.of('cancelled'), NOW);
        if (locked !== null) await orders.save(locked);
        return waiting;
      });
      const second = await blocked.outcome;

      // A segunda viu o pedido já cancelado: cancelled → cancelled é inválido.
      expect(second.status).toBe('rejected');
      expect(second.status === 'rejected' && second.reason).toBeInstanceOf(InvalidStatusTransitionError);
    });

    it('o mesmo entregador não é despachado em dois pedidos ao mesmo tempo', async () => {
      const first = readyOrderAssignedTo(COURIER_ID);
      const second = readyOrderAssignedTo(COURIER_ID);
      await save(first, second);
      const changeStatus = new ChangeOrderStatusUseCase(unitOfWork, new FixedClock(NOW));

      const blocked = await unitOfWork.transaction(async ({ orders, deliveryPersons }) => {
        const order = await orders.findByIdForUpdate(first.id);
        const availability = await deliveryPersons.availabilityOf(DeliveryPersonId.from(COURIER_ID));
        if (order === null || availability === null) throw new Error('dados de teste ausentes');

        // O segundo despacho chega ao lock do entregador e espera.
        const waiting = await startBlocked(() =>
          changeStatus.execute({ id: second.id.value, status: 'delivering' }),
        );
        order.dispatch(availability, NOW);
        await orders.save(order);
        return waiting;
      });
      const blockedDispatch = await blocked.outcome;

      expect(blockedDispatch.status).toBe('rejected');
      expect(blockedDispatch.status === 'rejected' && blockedDispatch.reason).toBeInstanceOf(
        DeliveryPersonUnavailableError,
      );
      expect((await find(second))?.status.value).toBe('ready');
    });
  });

  describe('restrições do banco', () => {
    it('índice único impede duas entregas em andamento do mesmo entregador', async () => {
      await save(buildOrderIn('delivering'), readyOrderAssignedTo(COURIER_ID));

      await expect(
        sql`UPDATE orders SET status = 'delivering' WHERE status = 'ready'`.execute(db),
      ).rejects.toThrow(/uq_orders_one_delivery_per_person/);
    });

    it('pedido despachado sem entregador é recusado', async () => {
      await save(buildOrderIn('ready'));

      await expect(
        sql`UPDATE orders SET status = 'delivering'`.execute(db),
      ).rejects.toThrow(/orders_dispatched_has_delivery_person/);
    });

    it('item com produto inexistente é recusado (FK)', async () => {
      const order = buildOrder({
        items: [
          {
            product: productSnapshot({ id: 'c0ffee00-1234-4abc-8def-0123456789ab' }),
            quantity: Quantity.of(1),
          },
        ],
      });

      await expect(save(order)).rejects.toThrow(/foreign key/i);
      expect(await db.selectFrom('orders').select('id').execute()).toHaveLength(0);
    });
  });

  describe('ACL do Catalog para o Ordering (remoção de produto)', () => {
    const catalogDb = db as unknown as Kysely<CatalogDatabase>;
    const removeProduct = new RemoveProductUseCase(
      new KyselyCatalogUnitOfWork(catalogDb, new InMemoryEventMediator()),
      new FixedClock(NOW),
    );

    it('recusa remover produto em pedido pending ou preparing', async () => {
      await save(buildOrderIn('preparing'));

      await expect(removeProduct.execute({ id: BURGER_ID })).rejects.toBeInstanceOf(ProductInUseError);
    });

    it('permite remover produto que só aparece em pedidos já finalizados', async () => {
      await save(buildOrderIn('delivered'));

      await expect(removeProduct.execute({ id: BURGER_ID })).resolves.toBeUndefined();
    });
  });
});
