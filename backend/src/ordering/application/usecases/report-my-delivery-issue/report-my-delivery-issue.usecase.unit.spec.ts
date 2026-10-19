import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { OrderNotFoundError } from '../../../domain';
import { availableCourier, buildOrderIn, COURIER_ID, LATER } from '../../../domain/order/testing/order.fixture';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import { InMemoryOrderingUnitOfWork } from '../../testing/in-memory-ordering-unit-of-work';
import { ReportMyDeliveryIssueUseCase } from './report-my-delivery-issue.usecase';

const NOW = new Date('2025-01-20T17:00:00Z');
const MY_USER = '5d8f9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('ReportMyDeliveryIssueUseCase', () => {
  let unitOfWork: InMemoryOrderingUnitOfWork;
  let reportIssue: ReportMyDeliveryIssueUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryOrderingUnitOfWork();
    unitOfWork.nameDeliveryPerson(COURIER_ID, 'Carlos Santos');
    unitOfWork.linkDeliveryPersonToUser(COURIER_ID, MY_USER);
    reportIssue = new ReportMyDeliveryIssueUseCase(unitOfWork, new FixedClock(NOW));
  });

  it('relata o problema na minha entrega, que continua comigo', async () => {
    const order = buildOrderIn('delivering');
    unitOfWork.givenOrders(order);

    const reported = await reportIssue.execute({ userId: MY_USER, orderId: order.id.value, reason: 'address_not_found' });

    expect(reported.status).toBe('delivering');
    expect(reported.deliveryIssues).toEqual([
      expect.objectContaining({ reason: 'address_not_found', note: null, reportedAt: NOW, resolvedAt: null }),
    ]);
    expect(unitOfWork.lockedOrderIds).toEqual([order.id.value]);
  });

  it('a entrega de outro entregador responde como inexistente', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER);
    order.dispatch(availableCourier(OTHER_COURIER_ID), LATER);
    unitOfWork.givenOrders(order);

    await expect(
      reportIssue.execute({ userId: MY_USER, orderId: order.id.value, reason: 'refused' }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(unitOfWork.committedOrder(order.id.value)?.deliveryIssues).toEqual([]);
  });

  it('motivo desconhecido e observação longa demais são recusados juntos, antes da transação', async () => {
    const error = await reportIssue
      .execute({ userId: MY_USER, orderId: buildOrderIn('delivering').id.value, reason: 'chuva', note: 'a'.repeat(151) })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InputValidationError);
    expect((error as InputValidationError).details.map((detail) => detail.field)).toEqual(['reason', 'note']);
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('usuário sem entregador vinculado: DeliveryPersonNotLinkedError', async () => {
    const order = buildOrderIn('delivering');
    unitOfWork.givenOrders(order);

    await expect(
      reportIssue.execute({ userId: '6e9a0b2c-3d4e-4f5a-9b0c-1d2e3f4a5b6c', orderId: order.id.value, reason: 'refused' }),
    ).rejects.toThrow(DeliveryPersonNotLinkedError);
  });
});
