import { describe, expect, it } from 'vitest';

import {
  BusinessRuleRejectedError,
  SERVICE_UNAVAILABLE_CODES,
  ServiceUnavailableError,
} from '../../../../shared-kernel/application';
import { AssignmentNotPendingError, type AssignmentPlan } from '../../../domain';
import { buildPlan } from '../../../domain/assignment/testing/assignment-plan.fixture';
import type { AssignmentGateway } from '../../ports/assignment-gateway';
import { AcceptAssignmentUseCase } from './accept-assignment.usecase';

class FakeAssignmentGateway implements AssignmentGateway {
  readonly dispatched: { orderId: string; deliveryPersonId: string }[] = [];
  dispatchError: Error | null = null;

  suggest(): Promise<AssignmentPlan> {
    return Promise.resolve(buildPlan());
  }

  dispatch(orderId: string, deliveryPersonId: string): Promise<void> {
    if (this.dispatchError !== null) return Promise.reject(this.dispatchError);
    this.dispatched.push({ orderId, deliveryPersonId });
    return Promise.resolve();
  }
}

describe('AcceptAssignmentUseCase', () => {
  it('despacha o pedido com o entregador sugerido e marca o par como aceito', async () => {
    const gateway = new FakeAssignmentGateway();

    const plan = await new AcceptAssignmentUseCase(gateway).execute({ plan: buildPlan(), orderId: 'order-2' });

    expect(gateway.dispatched).toEqual([{ orderId: 'order-2', deliveryPersonId: 'dp-2' }]);
    expect(plan.assignments[1]?.decision).toEqual({ status: 'accepted' });
  });

  it.each([
    ['INVALID_STATUS_TRANSITION', 'O pedido não está mais pronto'],
    ['DELIVERY_PERSON_UNAVAILABLE', 'O entregador está em outra entrega'],
  ])('sugestão desatualizada (%s): o par falha com a mensagem da API', async (code, message) => {
    const gateway = new FakeAssignmentGateway();
    gateway.dispatchError = new BusinessRuleRejectedError(code, message);

    const plan = await new AcceptAssignmentUseCase(gateway).execute({ plan: buildPlan(), orderId: 'order-1' });

    expect(plan.assignments[0]?.decision).toEqual({ status: 'failed', reason: message });
    expect(plan.assignments[1]?.decision).toEqual({ status: 'pending' });
  });

  it('falha de rede sobe e o par continua pendente para tentar de novo', async () => {
    const gateway = new FakeAssignmentGateway();
    const offline = new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.network, 'Sem conexão');
    gateway.dispatchError = offline;
    const plan = buildPlan();

    await expect(new AcceptAssignmentUseCase(gateway).execute({ plan, orderId: 'order-1' })).rejects.toBe(offline);
    expect(plan.pending).toHaveLength(2);
  });

  it('não despacha um par que já foi decidido', async () => {
    const gateway = new FakeAssignmentGateway();

    await expect(
      new AcceptAssignmentUseCase(gateway).execute({ plan: buildPlan().reject('order-1'), orderId: 'order-1' }),
    ).rejects.toThrow(AssignmentNotPendingError);
    expect(gateway.dispatched).toHaveLength(0);
  });
});
