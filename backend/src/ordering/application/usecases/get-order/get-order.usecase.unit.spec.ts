import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { OrderNotFoundError } from '../../../domain';
import {
  availableCourier,
  buildOrderIn,
  COURIER_ID,
  LATER,
  PLACED_AT,
} from '../../../domain/order/testing/order.fixture';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { GetOrderUseCase } from './get-order.usecase';

const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

describe('GetOrderUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let getOrder: GetOrderUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    getOrder = new GetOrderUseCase(unitOfWork);
  });

  it('devolve o pedido com itens e entregador atribuído, sem travar nada', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    unitOfWork.givenOrders(order);
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');

    const found = await getOrder.execute({ id: order.id.value });

    expect(found).toMatchObject({
      id: order.id.value,
      status: 'ready',
      totalAmount: 78.3,
      deliveryPerson: { id: COURIER_ID, name: 'Carlos Santos' },
      createdAt: PLACED_AT,
    });
    expect(found.items).toHaveLength(2);
    expect(unitOfWork.lockedOrderIds).toHaveLength(0);
    expect(unitOfWork.deliveryPersonLookups).toHaveLength(0);
  });

  it('mostra o entregador mesmo depois de removido do Delivery', async () => {
    const order = buildOrderIn('delivered');
    unitOfWork.givenOrders(order);
    unitOfWork.givenRemovedDeliveryPerson(COURIER_ID, 'Carlos Santos');

    const found = await getOrder.execute({ id: order.id.value });

    expect(found.deliveryPerson).toEqual({ id: COURIER_ID, name: 'Carlos Santos' });
  });

  it('pedido sem entregador não consulta o Delivery', async () => {
    const order = buildOrderIn('pending');
    unitOfWork.givenOrders(order);

    const found = await getOrder.execute({ id: order.id.value });

    expect(found.deliveryPerson).toBeNull();
    expect(unitOfWork.deliveryPersonSummaryLookups).toHaveLength(0);
  });

  it('rejeita pedido inexistente com ORDER_NOT_FOUND', async () => {
    await expect(getOrder.execute({ id: UNKNOWN_ID })).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('rejeita ID inválido sem abrir transação', async () => {
    await expect(getOrder.execute({ id: 'abc' })).rejects.toBeInstanceOf(InputValidationError);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('falha se o entregador atribuído não existe no Delivery (inconsistência entre contextos)', async () => {
    const order = buildOrderIn('delivered');
    unitOfWork.givenOrders(order);

    await expect(getOrder.execute({ id: order.id.value })).rejects.toThrow(
      /Entregadores atribuídos não encontrados/,
    );
  });
});
