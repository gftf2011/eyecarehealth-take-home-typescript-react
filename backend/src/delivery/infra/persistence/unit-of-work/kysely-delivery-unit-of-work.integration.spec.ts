import { sql, type Kysely } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { RecordingEventMediator } from '../../../../shared-kernel/application/testing/recording-event-mediator';
import { PerformanceStopwatch } from '../../../../shared-kernel/infra/clock/performance-stopwatch';
import { startBlocked } from '../../../../shared-kernel/infra/database/testing/start-blocked';
import {
  connectToTestDatabase,
  resetDatabase,
} from '../../../../shared-kernel/infra/database/testing/test-database';
import { InMemoryEventMediator } from '../../../../shared-kernel/infra/events/in-memory-event-mediator';
import {
  DeliveryPersonId as OrderingDeliveryPersonId,
  type Order,
} from '../../../../ordering/domain';
import {
  availableCourier,
  BURGER_ID,
  buildOrderIn,
  COURIER_ID,
  JUICE_ID,
  LATER,
} from '../../../../ordering/domain/order/testing/order.fixture';
import type { OrderingDatabase } from '../../../../ordering/infra/persistence/schema/ordering-database';
import { insertProduct } from '../../../../ordering/infra/persistence/testing/ordering-test-data';
import { KyselyOrderingUnitOfWork } from '../../../../ordering/infra/persistence/unit-of-work/kysely-ordering-unit-of-work';
import { RemoveDeliveryPersonUseCase } from '../../../application/usecases/remove-delivery-person/remove-delivery-person.usecase';
import { SuggestAssignmentUseCase } from '../../../application/usecases/suggest-assignment/suggest-assignment.usecase';
import {
  DeliveryPersonId,
  DeliveryPersonInUseError,
  DispatchOptimizer,
  GeoPoint,
  PersonName,
  type DeliveryPerson,
} from '../../../domain';
import { buildDeliveryPerson } from '../../../domain/delivery-person/testing/delivery-person.fixture';
import type { DeliveryDatabase } from '../schema/delivery-database';
import { KyselyDeliveryUnitOfWork } from './kysely-delivery-unit-of-work';

const db = connectToTestDatabase<DeliveryDatabase>();
const raw = db as unknown as Kysely<unknown>;
const mediator = new RecordingEventMediator();
const unitOfWork = new KyselyDeliveryUnitOfWork(db, mediator);
const ordering = new KyselyOrderingUnitOfWork(
  db as unknown as Kysely<OrderingDatabase>,
  new InMemoryEventMediator(),
);
const NOW = new Date('2025-01-20T16:00:00Z');

function person(overrides: Parameters<typeof buildDeliveryPerson>[0] = {}): DeliveryPerson {
  return buildDeliveryPerson(overrides);
}

async function save(...people: DeliveryPerson[]): Promise<void> {
  await unitOfWork.transaction(async ({ deliveryPersons }) => {
    for (const item of people) await deliveryPersons.save(item);
  });
}

async function saveOrders(...orders: Order[]): Promise<void> {
  await ordering.transaction(async ({ orders: repository }) => {
    for (const order of orders) await repository.save(order);
  });
}

/** O entregador padrão dos fixtures de pedido (COURIER_ID). */
const courier = (): DeliveryPerson =>
  person({ id: DeliveryPersonId.from(COURIER_ID), name: PersonName.create('Carlos Santos') });

describe('KyselyDeliveryUnitOfWork', () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await insertProduct(raw, { id: BURGER_ID, price: '32.90' });
    await insertProduct(raw, { id: JUICE_ID, name: 'Suco de Laranja', price: '12.50' });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('repositório', () => {
    it.each([
      ['com localização', person()],
      ['sem localização', person({ location: null })],
      ['inativo', person({ isActive: false })],
    ])('persiste e reidrata o entregador %s', async (_label, deliveryPerson) => {
      await save(deliveryPerson);

      const found = await unitOfWork.transaction(({ deliveryPersons }) =>
        deliveryPersons.findById(deliveryPerson.id),
      );

      expect(found?.snapshot()).toEqual(deliveryPerson.snapshot());
    });

    it('atualiza e publica os eventos no mediador antes do commit', async () => {
      const deliveryPerson = person();
      await save(deliveryPerson);
      const before = mediator.published.length;

      deliveryPerson.relocate(GeoPoint.create(-23.6, -46.7), LATER);
      deliveryPerson.deactivate(LATER);
      await save(deliveryPerson);

      const found = await unitOfWork.transaction(({ deliveryPersons }) =>
        deliveryPersons.findByIdForUpdate(deliveryPerson.id),
      );
      expect(found).toMatchObject({ isActive: false });
      expect(found?.location?.latitude).toBe(-23.6);
      expect(mediator.publishedNames.slice(before)).toEqual([
        'delivery.delivery-person.relocated',
        'delivery.delivery-person.activation-changed',
      ]);
    });

    it('removido não é encontrado nem listado, mas a linha continua no banco', async () => {
      const removed = person();
      removed.remove({ hasDeliveryInProgress: false, now: LATER });
      await save(removed);

      const [byId, forUpdate, listed] = await unitOfWork.transaction(async ({ deliveryPersons }) => [
        await deliveryPersons.findById(removed.id),
        await deliveryPersons.findByIdForUpdate(removed.id),
        await deliveryPersons.list({ isActive: null }),
      ]);

      expect([byId, forUpdate]).toEqual([null, null]);
      expect(listed).toHaveLength(0);
      expect(await db.selectFrom('delivery_persons').select('id').execute()).toHaveLength(1);
    });

    it('lista por nome, filtrando por ativo', async () => {
      const bruno = person({ name: PersonName.create('Bruno') });
      const ana = person({ name: PersonName.create('Ana') });
      const carla = person({ name: PersonName.create('Carla'), isActive: false });
      await save(bruno, ana, carla);

      const [all, active] = await unitOfWork.transaction(async ({ deliveryPersons }) => [
        await deliveryPersons.list({ isActive: null }),
        await deliveryPersons.list({ isActive: true }),
      ]);

      expect(all.map((item) => item.name.value)).toEqual(['Ana', 'Bruno', 'Carla']);
      expect(active.map((item) => item.name.value)).toEqual(['Ana', 'Bruno']);
    });
  });

  describe('ACL do Ordering', () => {
    it('reflete pedidos ready e entregas em andamento reais', async () => {
      await save(courier());
      const ready = buildOrderIn('ready');
      const delivering = buildOrderIn('delivering');
      await saveOrders(ready, delivering, buildOrderIn('pending'));

      const board = await unitOfWork.transaction(async ({ dispatchBoard }) => ({
        ready: await dispatchBoard.readyOrders(),
        inProgress: await dispatchBoard.deliveriesInProgress(),
        busy: await dispatchBoard.hasDeliveryInProgress(DeliveryPersonId.from(COURIER_ID)),
      }));

      expect(board.ready.map((order) => order.orderId.value)).toEqual([ready.id.value]);
      expect(board.ready[0]?.deliveryAddress).toBe(ready.deliveryAddress.value);
      expect(board.ready[0]?.location.latitude).toBe(ready.location.latitude);
      expect(board.inProgress.map((delivery) => [delivery.deliveryPersonId.value, delivery.orderId.value])).toEqual([
        [COURIER_ID, delivering.id.value],
      ]);
      expect(board.busy).toBe(true);
    });
  });

  describe('concorrência entre contextos', () => {
    it('remover um entregador espera o despacho concorrente e então recusa (409)', async () => {
      await save(courier());
      const order = buildOrderIn('ready');
      order.assignDeliveryPerson(availableCourier(), LATER);
      await saveOrders(order);
      const remove = new RemoveDeliveryPersonUseCase(unitOfWork, new FixedClock(NOW));

      const blocked = await ordering.transaction(async ({ orders, deliveryPersons }) => {
        const locked = await orders.findByIdForUpdate(order.id);
        const availability = await deliveryPersons.availabilityOf(OrderingDeliveryPersonId.from(COURIER_ID));
        if (locked === null || availability === null) throw new Error('dados de teste ausentes');

        const waiting = await startBlocked(() => remove.execute({ id: COURIER_ID }));
        locked.dispatch(availability, NOW);
        await orders.save(locked);
        return waiting;
      });
      const removal = await blocked.outcome;

      expect(removal.status).toBe('rejected');
      expect(removal.status === 'rejected' && removal.reason).toBeInstanceOf(DeliveryPersonInUseError);
      const row = await db.selectFrom('delivery_persons').select('deleted_at').executeTakeFirstOrThrow();
      expect(row.deleted_at).toBeNull();
    });
  });

  describe('SuggestAssignment no PostgreSQL', () => {
    it('responde em < 2s com 50 pedidos ready e 30 entregadores (requisito do endpoint)', async () => {
      await sql`
        INSERT INTO delivery_persons (id, name, phone, vehicle_type, is_active, current_latitude, current_longitude)
        SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'Entregador ' || n,
               '(11) 91234-' || lpad(n::text, 4, '0'), 'motorcycle', true,
               -23.55 + (n % 10) / 100.0, -46.63 + (n % 7) / 100.0
        FROM generate_series(1, 30) AS n
      `.execute(db);
      await sql`
        INSERT INTO orders (id, customer_name, customer_phone, delivery_address, latitude, longitude, status, total_amount)
        SELECT ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, 'Cliente ' || n,
               '(11) 99999-' || lpad(n::text, 4, '0'), 'Rua de Teste, ' || n || ', São Paulo - SP',
               -23.5 - (n % 13) / 100.0, -46.6 - (n % 11) / 100.0, 'ready', 45.40
        FROM generate_series(1, 50) AS n
      `.execute(db);
      const suggest = new SuggestAssignmentUseCase(unitOfWork, new DispatchOptimizer(), new PerformanceStopwatch());

      const startedAt = performance.now();
      const suggestion = await suggest.execute();
      const elapsedMs = performance.now() - startedAt;

      expect(suggestion.assignments).toHaveLength(30);
      expect(suggestion.unassigned).toHaveLength(20);
      expect(new Set(suggestion.assignments.map((a) => a.deliveryPersonId)).size).toBe(30);
      expect(elapsedMs).toBeLessThan(2_000);
    });
  });
});
