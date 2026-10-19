import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { InvalidStatusTransitionError, OrderNotFoundError } from '../../../domain';
import { buildOrderIn, COURIER_ID } from '../../../domain/order/testing/order.fixture';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ReturnOrderToAssignmentUseCase } from './return-order-to-assignment.usecase';

const NOW = new Date('2025-01-20T16:30:00Z');
const UNKNOWN_ID = 'c0ffee00-1234-4abc-8def-0123456789ab';

describe('ReturnOrderToAssignmentUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let returnToAssignment: ReturnOrderToAssignmentUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    returnToAssignment = new ReturnOrderToAssignmentUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('trava o pedido, devolve para ready sem entregador e devolve o histórico com o motivo', async () => {
    const order = buildOrderIn('delivering');
    unitOfWork.givenOrders(order);

    const returned = await returnToAssignment.execute({ id: order.id.value, reason: '  Moto quebrou  ' });

    expect(unitOfWork.lockedOrderIds).toEqual([order.id.value]);
    expect(returned).toMatchObject({ status: 'ready', deliveryPerson: null });
    expect(returned.statusHistory.at(-1)).toEqual({ from: 'delivering', to: 'ready', changedAt: NOW, reason: 'Moto quebrou' });
    expect(unitOfWork.committedOrder(order.id.value)?.deliveryPersonId).toBeNull();
    expect(unitOfWork.publishedEvents).toHaveLength(2);
  });

  it('pedido que não está em entrega: recusa e não altera nada', async () => {
    const order = buildOrderIn('ready');
    unitOfWork.givenOrders(order);

    await expect(returnToAssignment.execute({ id: order.id.value, reason: 'Sem contato' })).rejects.toThrow(
      InvalidStatusTransitionError,
    );
    expect(unitOfWork.commits).toBe(0);
  });

  it('pedido inexistente: 404', async () => {
    await expect(returnToAssignment.execute({ id: UNKNOWN_ID, reason: 'Sem contato' })).rejects.toThrow(
      OrderNotFoundError,
    );
  });

  it('id e motivo inválidos são recusados juntos, antes da transação', async () => {
    const error = await returnToAssignment.execute({ id: 'x', reason: 'a' }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InputValidationError);
    expect((error as InputValidationError).details).toEqual([
      expect.objectContaining({ field: 'orderId' }),
      { field: 'reason', message: 'O motivo deve ter entre 3 e 200 caracteres' },
    ]);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });
});
