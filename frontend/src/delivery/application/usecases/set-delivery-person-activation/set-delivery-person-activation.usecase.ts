import type { UseCase } from '../../../../shared-kernel/application';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import type { DeliveryPersonGateway } from '../../ports/delivery-person-gateway';

export type SetDeliveryPersonActivationInput = {
  readonly id: string;
  readonly isActive: boolean;
};

/** Ativa/desativa direto da listagem (só esse campo é enviado). Inativo não recebe atribuições. */
export class SetDeliveryPersonActivationUseCase
  implements UseCase<SetDeliveryPersonActivationInput, DeliveryPersonDto>
{
  constructor(private readonly deliveryPersons: DeliveryPersonGateway) {}

  async execute({ id, isActive }: SetDeliveryPersonActivationInput): Promise<DeliveryPersonDto> {
    const updated = await this.deliveryPersons.update(id, { isActive });
    return toDeliveryPersonDto(updated);
  }
}
