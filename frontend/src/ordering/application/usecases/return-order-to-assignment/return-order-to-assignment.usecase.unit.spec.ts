import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FakeOrderGateway } from '../../testing/fake-order.gateway';
import { ReturnOrderToAssignmentUseCase } from './return-order-to-assignment.usecase';

describe('ReturnOrderToAssignmentUseCase', () => {
  it('envia o motivo já validado (sem espaços nas pontas) e devolve o pedido atualizado', async () => {
    const gateway = new FakeOrderGateway();

    const returned = await new ReturnOrderToAssignmentUseCase(gateway).execute({ id: 'order-1', reason: '  Moto quebrou ' });

    expect(gateway.returns).toEqual([{ id: 'order-1', reason: 'Moto quebrou' }]);
    expect(returned.status).toBe('ready');
  });

  it('motivo inválido não chega à API', async () => {
    const gateway = new FakeOrderGateway();

    await expect(new ReturnOrderToAssignmentUseCase(gateway).execute({ id: 'order-1', reason: 'ab' })).rejects.toThrow(
      InputValidationError,
    );
    expect(gateway.returns).toEqual([]);
  });
});
