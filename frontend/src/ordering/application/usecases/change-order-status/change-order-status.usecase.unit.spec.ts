import { describe, expect, it } from 'vitest';

import { BusinessRuleRejectedError, InputValidationError } from '../../../../shared-kernel/application';
import { FakeOrderGateway } from '../../testing/fake-order.gateway';
import { ChangeOrderStatusUseCase } from './change-order-status.usecase';

describe('ChangeOrderStatusUseCase', () => {
  it('envia o novo status e devolve o pedido atualizado com as próximas ações', async () => {
    const gateway = new FakeOrderGateway();

    const order = await new ChangeOrderStatusUseCase(gateway).execute({ id: 'order-1', status: 'preparing' });

    expect(gateway.statusChanges).toEqual([{ id: 'order-1', status: 'preparing' }]);
    expect(order.status).toBe('preparing');
    expect(order.transitions.map((transition) => transition.to)).toEqual(['ready', 'cancelled']);
  });

  it('status desconhecido é recusado antes da API', async () => {
    const gateway = new FakeOrderGateway();

    await expect(new ChangeOrderStatusUseCase(gateway).execute({ id: 'order-1', status: 'shipped' })).rejects.toThrow(
      InputValidationError,
    );
    expect(gateway.statusChanges).toHaveLength(0);
  });

  it('transição recusada pela API (tela desatualizada) chega como regra de negócio', async () => {
    const gateway = new FakeOrderGateway();
    const rejection = new BusinessRuleRejectedError('INVALID_STATUS_TRANSITION', 'Transição não permitida');
    gateway.changeStatusAnswer = () => Promise.reject(rejection);

    await expect(new ChangeOrderStatusUseCase(gateway).execute({ id: 'order-1', status: 'ready' })).rejects.toBe(
      rejection,
    );
  });
});
