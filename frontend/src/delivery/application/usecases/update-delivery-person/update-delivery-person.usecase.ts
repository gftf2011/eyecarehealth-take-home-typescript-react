import type { UseCase } from '../../../../shared-kernel/application';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import {
  parseDeliveryPersonFormInput,
  type DeliveryPersonFormInput,
} from '../../inputs/delivery-person-form.input';
import type { DeliveryPersonGateway } from '../../ports/delivery-person-gateway';

export type UpdateDeliveryPersonInput = DeliveryPersonFormInput & { readonly id: string };

/**
 * Salva o formulário de edição. Envia todos os campos validados: coordenadas
 * em branco apagam a localização. `404` (entregador removido por outro
 * gestor) chega como `ResourceNotFoundError`.
 */
export class UpdateDeliveryPersonUseCase implements UseCase<UpdateDeliveryPersonInput, DeliveryPersonDto> {
  constructor(private readonly deliveryPersons: DeliveryPersonGateway) {}

  async execute({ id, ...input }: UpdateDeliveryPersonInput): Promise<DeliveryPersonDto> {
    const updated = await this.deliveryPersons.update(id, parseDeliveryPersonFormInput(input));
    return toDeliveryPersonDto(updated);
  }
}
