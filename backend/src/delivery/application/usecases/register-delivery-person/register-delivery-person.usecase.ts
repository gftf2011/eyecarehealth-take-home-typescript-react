import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import {
  DeliveryPerson,
  DeliveryPersonId,
  PersonName,
  PhoneNumber,
  VehicleType,
} from '../../../domain';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import { parseLocationInput } from '../../inputs/location.input';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

export type RegisterDeliveryPersonInput = {
  readonly name: string;
  readonly phone: string;
  readonly vehicleType: string;
  /** Padrão: `true`. */
  readonly isActive?: boolean | undefined;
  /** Latitude e longitude vêm juntas; ausentes ou nulas = posição desconhecida. */
  readonly currentLatitude?: number | null | undefined;
  readonly currentLongitude?: number | null | undefined;
};

/** Cadastra um entregador. */
export class RegisterDeliveryPersonUseCase
  implements UseCase<RegisterDeliveryPersonInput, DeliveryPersonDto>
{
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterDeliveryPersonInput): Promise<DeliveryPersonDto> {
    const details = validateInput({
      name: () => PersonName.create(input.name),
      phone: () => PhoneNumber.create(input.phone),
      vehicleType: () => VehicleType.create(input.vehicleType),
      location: () => parseLocationInput(input.currentLatitude, input.currentLongitude) ?? null,
    });

    const person = DeliveryPerson.register({
      id: DeliveryPersonId.generate(),
      ...details,
      isActive: input.isActive ?? true,
      now: this.clock.now(),
    });

    return this.unitOfWork.transaction(async ({ deliveryPersons }) => {
      await deliveryPersons.save(person);
      // Recém-cadastrado: nenhuma entrega em andamento.
      return toDeliveryPersonDto(person, null);
    });
  }
}
