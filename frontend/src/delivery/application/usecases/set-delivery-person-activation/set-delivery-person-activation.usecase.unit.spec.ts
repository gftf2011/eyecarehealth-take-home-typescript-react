import { describe, expect, it } from 'vitest';

import { FakeDeliveryPersonGateway } from '../../testing/fake-delivery-person.gateway';
import { SetDeliveryPersonActivationUseCase } from './set-delivery-person-activation.usecase';

describe('SetDeliveryPersonActivationUseCase', () => {
  it('envia só a ativação', async () => {
    const gateway = new FakeDeliveryPersonGateway();

    const updated = await new SetDeliveryPersonActivationUseCase(gateway).execute({ id: 'courier-1', isActive: false });

    expect(gateway.updates).toEqual([{ id: 'courier-1', changes: { isActive: false } }]);
    expect(updated.isActive).toBe(false);
  });
});
