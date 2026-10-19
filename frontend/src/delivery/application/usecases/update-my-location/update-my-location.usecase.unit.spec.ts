import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FakeMyDeliveriesGateway } from '../../testing/fake-my-deliveries.gateway';
import { UpdateMyLocationUseCase } from './update-my-location.usecase';

describe('UpdateMyLocationUseCase', () => {
  it('envia a posição validada', async () => {
    const gateway = new FakeMyDeliveriesGateway();

    await new UpdateMyLocationUseCase(gateway).execute({ latitude: -23.5614, longitude: -46.6559 });

    expect(gateway.locations.map(({ latitude, longitude }) => [latitude, longitude])).toEqual([[-23.5614, -46.6559]]);
  });

  it('posição fora da faixa não chega à API', async () => {
    const gateway = new FakeMyDeliveriesGateway();

    await expect(new UpdateMyLocationUseCase(gateway).execute({ latitude: 95, longitude: 0 })).rejects.toThrow(
      InputValidationError,
    );
    expect(gateway.locations).toEqual([]);
  });
});
