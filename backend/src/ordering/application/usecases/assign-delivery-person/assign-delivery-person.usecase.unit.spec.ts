import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonAssigned,
  DeliveryPersonAssignmentNotAllowedError,
  DeliveryPersonAvailability,
  DeliveryPersonId,
  DeliveryPersonUnavailableError,
  OrderNotFoundError,
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
import { AssignDeliveryPersonUseCase } from './assign-delivery-person.usecase';

const NOW = new Date('2025-01-20T15:30:00Z');
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

function courier(
  id: string,
  { isActive = true, busy = false }: { isActive?: boolean; busy?: boolean } = {},
): DeliveryPersonAvailability {
  return DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(id),
    isActive,
    hasDeliveryInProgress: busy,
  });
}

describe('AssignDeliveryPersonUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let assign: AssignDeliveryPersonUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.givenDeliveryPersons(courier(COURIER_ID), courier(OTHER_COURIER_ID));
    assign = new AssignDeliveryPersonUseCase(unitOfWork, new FixedClock(NOW));
  });

  it.each(['pending', 'preparing', 'ready'] satisfies OrderStatusValue[])(
    'atribui entregador disponível a pedido %s',
    async (status) => {
      const order = buildOrderIn(status);
      unitOfWork.givenOrders(order);

      const updated = await assign.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

      expect(updated).toMatchObject({ status, deliveryPersonId: COURIER_ID, updatedAt: NOW });
      expect(unitOfWork.committedOrder(order.id.value)?.deliveryPersonId?.value).toBe(COURIER_ID);
      expect(unitOfWork.deliveryPersonLookups).toEqual([COURIER_ID]);
    },
  );

  it('publica DeliveryPersonAssigned ao confirmar a transação', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    await assign.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.publishedEvents).toHaveLength(1);
    expect(unitOfWork.publishedEvents[0]).toBeInstanceOf(DeliveryPersonAssigned);
    expect(unitOfWork.publishedEvents[0]?.payload).toEqual({
      deliveryPersonId: COURIER_ID,
      previousDeliveryPersonId: null,
    });
  });

  it('troca o entregador antes do despacho', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    unitOfWork.givenOrders(order);

    const updated = await assign.execute({ id: order.id.value, deliveryPersonId: OTHER_COURIER_ID });

    expect(updated.deliveryPersonId).toBe(OTHER_COURIER_ID);
    expect(unitOfWork.publishedEvents[0]?.payload).toEqual({
      deliveryPersonId: OTHER_COURIER_ID,
      previousDeliveryPersonId: COURIER_ID,
    });
  });

  it('reatribuir o mesmo entregador não altera o pedido nem publica evento', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    unitOfWork.givenOrders(order);

    const updated = await assign.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    expect(updated).toMatchObject({ deliveryPersonId: COURIER_ID, updatedAt: LATER });
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });

  it('permite o mesmo entregador em dois pedidos ready (a entrega dupla é barrada no despacho)', async () => {
    const first = buildOrderIn('ready');
    const second = buildOrderIn('ready');
    unitOfWork.givenOrders(first, second);

    await assign.execute({ id: first.id.value, deliveryPersonId: COURIER_ID });
    await assign.execute({ id: second.id.value, deliveryPersonId: COURIER_ID });

    expect(unitOfWork.committedOrder(second.id.value)?.deliveryPersonId?.value).toBe(COURIER_ID);
  });

  it.each([
    ['inativo', { isActive: false }, 'Este entregador está inativo'],
    ['com entrega em andamento', { busy: true }, 'Este entregador já está atribuído a outro pedido em andamento'],
  ])('rejeita entregador %s com DELIVERY_PERSON_UNAVAILABLE', async (_label, state, message) => {
    unitOfWork.givenDeliveryPersons(courier(COURIER_ID, state));
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    const attempt = assign.execute({ id: order.id.value, deliveryPersonId: COURIER_ID });

    await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonUnavailableError);
    await expect(attempt).rejects.toMatchObject({
      code: 'DELIVERY_PERSON_UNAVAILABLE',
      message,
      details: [{ deliveryPersonId: COURIER_ID }],
    });
    expect(unitOfWork.committedOrder(order.id.value)?.deliveryPersonId).toBeNull();
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });

  it.each(['delivering', 'delivered', 'cancelled'] satisfies OrderStatusValue[])(
    'rejeita atribuição a pedido %s com ASSIGNMENT_NOT_ALLOWED',
    async (status) => {
      const order = buildOrderIn(status);
      unitOfWork.givenOrders(order);

      const attempt = assign.execute({ id: order.id.value, deliveryPersonId: OTHER_COURIER_ID });

      await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonAssignmentNotAllowedError);
      await expect(attempt).rejects.toMatchObject({
        code: 'ASSIGNMENT_NOT_ALLOWED',
        message: `Não é possível atribuir entregador a um pedido com status '${status}'`,
      });
    },
  );

  it('rejeita entregador inexistente ou removido com DELIVERY_PERSON_NOT_FOUND', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    const attempt = assign.execute({ id: order.id.value, deliveryPersonId: UNKNOWN_ID });

    await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonNotFoundError);
    await expect(attempt).rejects.toMatchObject({ details: [{ deliveryPersonId: UNKNOWN_ID }] });
    expect(unitOfWork.rollbacks).toBe(1);
  });

  it('rejeita pedido inexistente com ORDER_NOT_FOUND, sem consultar o Delivery', async () => {
    const attempt = assign.execute({ id: UNKNOWN_ID, deliveryPersonId: COURIER_ID });

    await expect(attempt).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
  });

  it('rejeita IDs inválidos listando ambos, sem abrir transação', async () => {
    const attempt = assign.execute({ id: 'abc', deliveryPersonId: 'xyz' });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'orderId', message: "O identificador 'abc' não é um UUID válido" },
        { field: 'deliveryPersonId', message: "O identificador 'xyz' não é um UUID válido" },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o entregador não fica atribuído', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(
      assign.execute({ id: order.id.value, deliveryPersonId: COURIER_ID }),
    ).rejects.toBe(databaseDown);

    expect(unitOfWork.committedOrder(order.id.value)?.deliveryPersonId).toBeNull();
    expect(unitOfWork.publishedEvents).toHaveLength(0);
  });
});
