import { beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { InvalidStatusTransitionError, OrderNotFoundError } from '../../../domain';
import { availableCourier, buildOrderIn, COURIER_ID, LATER } from '../../../domain/order/testing/order.fixture';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ConfirmMyDeliveryUseCase } from './confirm-my-delivery.usecase';

const NOW = new Date('2025-01-20T17:00:00Z');
const MY_USER = '5d8f9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('ConfirmMyDeliveryUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let confirm: ConfirmMyDeliveryUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    unitOfWork.nameDeliveryPerson(OTHER_COURIER_ID, 'Ana Lima');
    unitOfWork.linkDeliveryPersonToUser(COURIER_ID, MY_USER);
    confirm = new ConfirmMyDeliveryUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('confirma a minha entrega: delivering → delivered', async () => {
    const order = buildOrderIn('delivering');
    unitOfWork.givenOrders(order);

    const delivered = await confirm.execute({ userId: MY_USER, orderId: order.id.value });

    expect(delivered).toMatchObject({ status: 'delivered', deliveryPerson: { id: COURIER_ID, name: 'Carlos Santos' } });
    expect(unitOfWork.lockedOrderIds).toEqual([order.id.value]);
  });

  it('pedido de outro entregador responde como inexistente, sem alterar nada', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER);
    order.dispatch(availableCourier(OTHER_COURIER_ID), LATER);
    unitOfWork.givenOrders(order);

    await expect(confirm.execute({ userId: MY_USER, orderId: order.id.value })).rejects.toThrow(OrderNotFoundError);
    expect(unitOfWork.committedOrder(order.id.value)?.status.value).toBe('delivering');
  });

  it('pedido meu que ainda não saiu: a máquina de estados recusa', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    unitOfWork.givenOrders(order);

    await expect(confirm.execute({ userId: MY_USER, orderId: order.id.value })).rejects.toThrow(
      InvalidStatusTransitionError,
    );
  });

  it('usuário sem entregador vinculado: DeliveryPersonNotLinkedError', async () => {
    const order = buildOrderIn('delivering');
    unitOfWork.givenOrders(order);

    await expect(
      confirm.execute({ userId: '6e9a0b2c-3d4e-4f5a-9b0c-1d2e3f4a5b6c', orderId: order.id.value }),
    ).rejects.toThrow(DeliveryPersonNotLinkedError);
  });
});
