import type { UseCase } from '../../../../shared-kernel/application';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import {
  parseDeliveryPersonFormInput,
  type DeliveryPersonFormInput,
} from '../../inputs/delivery-person-form.input';
import type { DeliveryPersonGateway } from '../../ports/delivery-person-gateway';

/** Cadastra um entregador. Campos inválidos são recusados antes da API, todos de uma vez. */
export class RegisterDeliveryPersonUseCase implements UseCase<DeliveryPersonFormInput, DeliveryPersonDto> {
  constructor(private readonly deliveryPersons: DeliveryPersonGateway) {}

  async execute(input: DeliveryPersonFormInput): Promise<DeliveryPersonDto> {
    const registered = await this.deliveryPersons.register(parseDeliveryPersonFormInput(input));
    return toDeliveryPersonDto(registered);
  }
}
