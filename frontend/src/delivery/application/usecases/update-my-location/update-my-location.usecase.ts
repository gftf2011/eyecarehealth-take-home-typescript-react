import { validateInput, type UseCase } from '../../../../shared-kernel/application';
import { GeoLocation } from '../../../domain';
import type { MyDeliveriesGateway } from '../../ports/my-deliveries-gateway';

export type UpdateMyLocationInput = {
  readonly latitude: number;
  readonly longitude: number;
};

/** O entregador informa onde está (a posição do celular): entra na próxima sugestão de atribuição. */
export class UpdateMyLocationUseCase implements UseCase<UpdateMyLocationInput, void> {
  constructor(private readonly deliveries: MyDeliveriesGateway) {}

  async execute({ latitude, longitude }: UpdateMyLocationInput): Promise<void> {
    const { location } = validateInput({ location: () => GeoLocation.create(latitude, longitude) });
    await this.deliveries.updateLocation(location);
  }
}
