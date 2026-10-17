import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonAssigned,
  DeliveryPersonAvailability,
  DeliveryPersonId,
  DeliveryPersonUnavailableError,
  InvalidStatusTransitionError,
  OrderNotFoundError,
  OrderStatusChanged,
  type OrderStatusValue,
} from '../../../domain';
import {
  availableCourier,
  buildOrderIn,
  COURIER_ID,
  LATER,
} from '../../../domain/order/testing/order.fixture';
import { DeliveryPersonNotFoundError } from '../../errors/delivery-person-not-found.error';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { DispatchOrderUseCase } from './dispatch-order.usecase';

const NOW = new Date('2025-01-20T16:00:00Z');
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

function courier(id: string, { isActive = true, busy = false } = {}): DeliveryPersonAvailability {
  return DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(id),
    isActive,
    hasDeliveryInProgress: busy,
  });
}

describe('DispatchOrderUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let dispatch: DispatchOrderUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    unitOfWork.nameDeliveryPerson(OTHER_COURIER_ID, 'Ana Lima');
    unitOfWork.givenDeliveryPersons(courier(COURIER_ID), courier(OTHER_COURIER_ID));
    dispatch = new DispatchOrderUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('atribui e despacha na mesma transação, travando pedido e entregador', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    const dispatched = await dispatch.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    expect(dispatched).toMatchObject({
      status: 'delivering',
      deliveryPerson: { id: COURIER_ID, name: 'Carlos Santos' },
      updatedAt: NOW,
    });
    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.lockedOrderIds).toEqual([order.id.value]);
    expect(unitOfWork.deliveryPersonLookups).toEqual([COURIER_ID]);
    expect(unitOfWork.committedOrder(order.id.value)?.statusHistory.at(-1)).toMatchObject({
      from: 'ready',
      to: 'delivering',
    });
  });

  it('publica a atribuição e depois a mudança de status', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    await dispatch.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([
      DeliveryPersonAssigned,
      OrderStatusChanged,
    ]);
    expect(unitOfWork.publishedEvents[1]?.payload).toEqual({
      from: 'ready',
      to: 'delivering',
      deliveryPersonId: COURIER_ID,
    });
  });

  it('troca o entregador atribuído antes, se a sugestão escolheu outro', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    unitOfWork.givenOrders(order);

    const dispatched = await dispatch.execute({ id: order.id.value, deliveryPersonId: OTHER_COURIER_ID });

    expect(dispatched.deliveryPerson).toEqual({ id: OTHER_COURIER_ID, name: 'Ana Lima' });
    expect(unitOfWork.publishedEvents[0]?.payload).toEqual({
      deliveryPersonId: OTHER_COURIER_ID,
      previousDeliveryPersonId: COURIER_ID,
    });
  });

  it.each(['pending', 'preparing', 'delivering', 'delivered', 'cancelled'] satisfies OrderStatusValue[])(
    'pedido %s (sugestão velha): 422 INVALID_STATUS_TRANSITION, sem consultar o entregador',
    async (status) => {
      const order = buildOrderIn(status);
      unitOfWork.givenOrders(order);

      const attempt = dispatch.execute({ id: order.id.value, deliveryPersonId: OTHER_COURIER_ID });

      await expect(attempt).rejects.toBeInstanceOf(InvalidStatusTransitionError);
      await expect(attempt).rejects.toMatchObject({
        message: `Não é possível alterar o status de '${status}' para 'delivering'`,
      });
      expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
      expect(unitOfWork.publishedEvents).toHaveLength(0);
    },
  );

  it.each([
    ['já saiu para outra entrega', { busy: true }],
    ['foi desativado', { isActive: false }],
  ])('entregador que %s: 422 DELIVERY_PERSON_UNAVAILABLE, sem atribuir', async (_label, state) => {
    unitOfWork.givenDeliveryPersons(courier(COURIER_ID, state));
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    const attempt = dispatch.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonUnavailableError);
    const stored = unitOfWork.committedOrder(order.id.value);
    expect(stored?.status.value).toBe('ready');
    expect(stored?.deliveryPersonId).toBeNull();
  });

  it('404 para pedido ou entregador inexistente', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    await expect(
      dispatch.execute({ id: UNKNOWN_ID, deliveryPersonId: COURIER_ID }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(
      dispatch.execute({ id: order.id.value, deliveryPersonId: UNKNOWN_ID }),
    ).rejects.toBeInstanceOf(DeliveryPersonNotFoundError);
  });

  it('rejeita IDs inválidos listando ambos, sem abrir transação', async () => {
    const attempt = dispatch.execute({ id: 'abc', deliveryPersonId: 'xyz' });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [{ field: 'orderId' }, { field: 'deliveryPersonId' }],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o pedido continua ready e sem entregador', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(
      dispatch.execute({ id: order.id.value, deliveryPersonId: COURIER_ID }),
    ).rejects.toBe(databaseDown);

    const stored = unitOfWork.committedOrder(order.id.value);
    expect(stored?.status.value).toBe('ready');
    expect(stored?.deliveryPersonId).toBeNull();
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
