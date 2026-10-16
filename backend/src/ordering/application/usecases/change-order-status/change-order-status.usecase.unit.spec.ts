import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import {
  DeliveryPersonAvailability,
  DeliveryPersonId,
  DeliveryPersonUnavailableError,
  InvalidStatusTransitionError,
  OrderNotFoundError,
  OrderStatusChanged,
  type Order,
} from '../../../domain';
import {
  availableCourier,
  buildOrderIn,
  COURIER_ID,
  LATER,
} from '../../../domain/order/testing/order.fixture';
import { DeliveryPersonNotFoundError } from '../../errors/delivery-person-not-found.error';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ChangeOrderStatusUseCase } from './change-order-status.usecase';

const NOW = new Date('2025-01-20T15:30:00Z');
const UNKNOWN_ORDER_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

/** Pedido `ready` com o entregador padrão já atribuído (sem eventos pendentes). */
function readyOrderWithCourier(): Order {
  const order = buildOrderIn('ready');
  order.assignDeliveryPerson(availableCourier(), LATER);
  order.pullDomainEvents();
  return order;
}

function courier(isActive: boolean, hasDeliveryInProgress: boolean): DeliveryPersonAvailability {
  return DeliveryPersonAvailability.create({
    deliveryPersonId: DeliveryPersonId.from(COURIER_ID),
    isActive,
    hasDeliveryInProgress,
  });
}

describe('ChangeOrderStatusUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let changeStatus: ChangeOrderStatusUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    changeStatus = new ChangeOrderStatusUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('aplica transição válida, registra o histórico e devolve o pedido atualizado', async () => {
    const order = buildOrderIn('pending');
    unitOfWork.givenOrders(order);

    const updated = await changeStatus.execute({ id: order.id.value, status: 'preparing' });

    expect(updated).toMatchObject({ id: order.id.value, status: 'preparing', updatedAt: NOW });
    const stored = unitOfWork.committedOrder(order.id.value);
    expect(stored?.status.value).toBe('preparing');
    expect(stored?.statusHistory.at(-1)).toMatchObject({ from: 'pending', to: 'preparing' });
    expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
  });

  it('grava OrderStatusChanged no outbox na mesma transação', async () => {
    const order = buildOrderIn('preparing');
    unitOfWork.givenOrders(order);

    await changeStatus.execute({ id: order.id.value, status: 'ready' });

    expect(unitOfWork.commits).toBe(1);
    expect(unitOfWork.outbox).toHaveLength(1);
    expect(unitOfWork.outbox[0]).toBeInstanceOf(OrderStatusChanged);
    expect(unitOfWork.outbox[0]?.payload).toEqual({ from: 'preparing', to: 'ready', deliveryPersonId: null });
  });

  it.each([
    ['delivered', 'pending'],
    ['delivering', 'cancelled'],
    ['pending', 'ready'],
    ['cancelled', 'preparing'],
  ] as const)('rejeita %s → %s com INVALID_STATUS_TRANSITION, sem gravar nada', async (from, to) => {
    const order = buildOrderIn(from);
    unitOfWork.givenOrders(order);

    const attempt = changeStatus.execute({ id: order.id.value, status: to });

    await expect(attempt).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    await expect(attempt).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Não é possível alterar o status de '${from}' para '${to}'`,
    });
    expect(unitOfWork.committedOrder(order.id.value)?.status.value).toBe(from);
    expect(unitOfWork.outbox).toHaveLength(0);
  });

  describe('despacho (ready → delivering)', () => {
    it('despacha quando o entregador atribuído está ativo e livre', async () => {
      const order = readyOrderWithCourier();
      unitOfWork.givenOrders(order);
      unitOfWork.givenDeliveryPersons(courier(true, false));

      const updated = await changeStatus.execute({ id: order.id.value, status: 'delivering' });

      expect(updated).toMatchObject({ status: 'delivering', deliveryPersonId: COURIER_ID });
      expect(unitOfWork.deliveryPersonLookups).toEqual([COURIER_ID]);
      expect(unitOfWork.outbox[0]?.payload).toEqual({
        from: 'ready',
        to: 'delivering',
        deliveryPersonId: COURIER_ID,
      });
    });

    it('rejeita sem entregador atribuído, sem consultar o Delivery', async () => {
      const order = buildOrderIn('ready');
      unitOfWork.givenOrders(order);

      const attempt = changeStatus.execute({ id: order.id.value, status: 'delivering' });

      await expect(attempt).rejects.toBeInstanceOf(InvalidStatusTransitionError);
      await expect(attempt).rejects.toThrow(/é obrigatório ter um entregador atribuído/);
      expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
    });

    it('rejeita pedido fora de ready, sem consultar o Delivery', async () => {
      const order = buildOrderIn('preparing');
      order.assignDeliveryPerson(availableCourier(), LATER);
      unitOfWork.givenOrders(order);

      await expect(
        changeStatus.execute({ id: order.id.value, status: 'delivering' }),
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
        message: "Não é possível alterar o status de 'preparing' para 'delivering'",
      });
      expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
    });

    it.each([
      ['já despachado em outro pedido', true, true],
      ['desativado depois da atribuição', false, false],
    ])('rejeita entregador %s com DELIVERY_PERSON_UNAVAILABLE', async (_label, isActive, busy) => {
      const order = readyOrderWithCourier();
      unitOfWork.givenOrders(order);
      unitOfWork.givenDeliveryPersons(courier(isActive, busy));

      const attempt = changeStatus.execute({ id: order.id.value, status: 'delivering' });

      await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonUnavailableError);
      expect(unitOfWork.committedOrder(order.id.value)?.status.value).toBe('ready');
      expect(unitOfWork.outbox).toHaveLength(0);
    });

    it('rejeita entregador removido do Delivery com DELIVERY_PERSON_NOT_FOUND', async () => {
      const order = readyOrderWithCourier();
      unitOfWork.givenOrders(order);

      const attempt = changeStatus.execute({ id: order.id.value, status: 'delivering' });

      await expect(attempt).rejects.toBeInstanceOf(DeliveryPersonNotFoundError);
      await expect(attempt).rejects.toMatchObject({
        code: 'DELIVERY_PERSON_NOT_FOUND',
        details: [{ deliveryPersonId: COURIER_ID }],
      });
    });
  });

  it('rejeita pedido inexistente com ORDER_NOT_FOUND', async () => {
    const attempt = changeStatus.execute({ id: UNKNOWN_ORDER_ID, status: 'preparing' });

    await expect(attempt).rejects.toBeInstanceOf(OrderNotFoundError);
    await expect(attempt).rejects.toMatchObject({ details: [{ orderId: UNKNOWN_ORDER_ID }] });
  });

  it('rejeita id e status inválidos listando ambos, sem abrir transação', async () => {
    const attempt = changeStatus.execute({ id: 'not-a-uuid', status: 'shipped' });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'orderId', message: "O identificador 'not-a-uuid' não é um UUID válido" },
        {
          field: 'status',
          message: 'O status deve ser um de: pending, preparing, ready, delivering, delivered, cancelled',
        },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('é atômico: se o commit falhar, o status e o evento não são gravados', async () => {
    const order = buildOrderIn('pending');
    unitOfWork.givenOrders(order);
    const databaseDown = new Error('conexão perdida');
    unitOfWork.failNextCommitWith(databaseDown);

    await expect(changeStatus.execute({ id: order.id.value, status: 'cancelled' })).rejects.toBe(
      databaseDown,
    );

    expect(unitOfWork.rollbacks).toBe(1);
    expect(unitOfWork.committedOrder(order.id.value)?.status.value).toBe('pending');
    expect(unitOfWork.outbox).toHaveLength(0);
  });
});
