import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import {
  DeliveryPersonId,
  DeliveryPersonNotFoundError,
  PersonName,
  PhoneNumber,
  VehicleType,
  type DeliveryPerson,
  type DeliveryPersonDetailsChanges,
} from '../../../domain';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import { parseLocationInput } from '../../inputs/location.input';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

/** Atualização parcial: só os campos enviados são alterados. */
export type UpdateDeliveryPersonInput = {
  readonly id: string;
  readonly name?: string | undefined;
  readonly phone?: string | undefined;
  readonly vehicleType?: string | undefined;
  readonly isActive?: boolean | undefined;
  /** As duas juntas; as duas `null` apagam a localização. */
  readonly currentLatitude?: number | null | undefined;
  readonly currentLongitude?: number | null | undefined;
};

/** Atualiza dados, ativação e localização de um entregador. */
export class UpdateDeliveryPersonUseCase
  implements UseCase<UpdateDeliveryPersonInput, DeliveryPersonDto>
{
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateDeliveryPersonInput): Promise<DeliveryPersonDto> {
    const validated = validateInput({
      id: () => DeliveryPersonId.from(input.id),
      name: () => (input.name === undefined ? undefined : PersonName.create(input.name)),
      phone: () => (input.phone === undefined ? undefined : PhoneNumber.create(input.phone)),
      vehicleType: () =>
        input.vehicleType === undefined ? undefined : VehicleType.create(input.vehicleType),
      location: () => parseLocationInput(input.currentLatitude, input.currentLongitude),
    });

    return this.unitOfWork.transaction(async ({ deliveryPersons, dispatchBoard }) => {
      const person = await deliveryPersons.findByIdForUpdate(validated.id);
      if (person === null) throw new DeliveryPersonNotFoundError(input.id);

      const now = this.clock.now();
      person.updateDetails(detailChanges(validated), now);
      if (input.isActive !== undefined) changeActivation(person, input.isActive, now);
      if (validated.location !== undefined) person.relocate(validated.location, now);

      await deliveryPersons.save(person);
      const current = (await dispatchBoard.deliveriesInProgress()).find((delivery) =>
        delivery.deliveryPersonId.equals(person.id),
      );
      return toDeliveryPersonDto(person, current?.orderId.value ?? null);
    });
  }
}

/** Monta só com os campos enviados (`exactOptionalPropertyTypes` proíbe `undefined` explícito). */
function detailChanges(validated: {
  name: PersonName | undefined;
  phone: PhoneNumber | undefined;
  vehicleType: VehicleType | undefined;
}): DeliveryPersonDetailsChanges {
  return {
    ...(validated.name !== undefined && { name: validated.name }),
    ...(validated.phone !== undefined && { phone: validated.phone }),
    ...(validated.vehicleType !== undefined && { vehicleType: validated.vehicleType }),
  };
}

function changeActivation(person: DeliveryPerson, isActive: boolean, now: Date): void {
  if (isActive) person.activate(now);
  else person.deactivate(now);
}
