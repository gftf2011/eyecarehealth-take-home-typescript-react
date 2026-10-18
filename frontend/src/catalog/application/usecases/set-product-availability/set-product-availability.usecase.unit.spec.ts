import { describe, expect, it } from 'vitest';

import { FakeProductGateway } from '../../testing/fake-product.gateway';
import { SetProductAvailabilityUseCase } from './set-product-availability.usecase';

describe('SetProductAvailabilityUseCase', () => {
  it('envia só a disponibilidade', async () => {
    const gateway = new FakeProductGateway();

    const product = await new SetProductAvailabilityUseCase(gateway).execute({ id: 'product-1', isAvailable: false });

    expect(gateway.updates).toEqual([{ id: 'product-1', changes: { isAvailable: false } }]);
    expect(product.isAvailable).toBe(false);
  });
});
