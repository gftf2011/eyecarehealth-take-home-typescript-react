import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import type { GeoLocation, MyDeliveries } from '../../../domain';
import type { MyDeliveriesGateway } from '../../ports/my-deliveries-gateway';
import { UpdateMyLocationUseCase } from './update-my-location.usecase';

class RecordingGateway implements MyDeliveriesGateway {
  readonly locations: GeoLocation[] = [];

  load(): Promise<MyDeliveries> {
    return Promise.reject(new Error('não usado'));
  }

  confirmDelivered(): Promise<void> {
    return Promise.resolve();
  }

  updateLocation(location: GeoLocation): Promise<void> {
    this.locations.push(location);
    return Promise.resolve();
  }
}

describe('UpdateMyLocationUseCase', () => {
  it('envia a posição validada', async () => {
    const gateway = new RecordingGateway();

    await new UpdateMyLocationUseCase(gateway).execute({ latitude: -23.5614, longitude: -46.6559 });

    expect(gateway.locations.map(({ latitude, longitude }) => [latitude, longitude])).toEqual([[-23.5614, -46.6559]]);
  });

  it('posição fora da faixa não chega à API', async () => {
    const gateway = new RecordingGateway();

    await expect(new UpdateMyLocationUseCase(gateway).execute({ latitude: 95, longitude: 0 })).rejects.toThrow(
      InputValidationError,
    );
    expect(gateway.locations).toEqual([]);
  });
});
