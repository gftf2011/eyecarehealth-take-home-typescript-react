import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { GeoPoint, UserAccountId } from '../../../domain';
import { toDeliveryPersonDto, type DeliveryPersonDto } from '../../dtos/delivery-person.dto';
import { DeliveryPersonNotLinkedError } from '../../errors/delivery-person-not-linked.error';
import type { DeliveryUnitOfWork } from '../../ports/delivery-unit-of-work';

export type UpdateMyLocationInput = {
  /** Usuário logado (do token): é o dono, nunca vem do corpo da requisição. */
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
};

const LOCATION_FIELDS = { latitude: 'latitude', longitude: 'longitude' };

/**
 * O próprio entregador informa onde está (pela geolocalização do celular). A
 * posição entra na próxima sugestão de atribuição. Ele só altera a si mesmo:
 * o entregador vem do usuário do token.
 */
export class UpdateMyLocationUseCase implements UseCase<UpdateMyLocationInput, DeliveryPersonDto> {
  constructor(
    private readonly unitOfWork: DeliveryUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateMyLocationInput): Promise<DeliveryPersonDto> {
    const { userId, location } = validateInput({
      userId: () => UserAccountId.from(input.userId),
      location: () => GeoPoint.create(input.latitude, input.longitude, LOCATION_FIELDS),
    });

    return this.unitOfWork.transaction(async ({ deliveryPersons, dispatchBoard }) => {
      const person = await deliveryPersons.findByUserIdForUpdate(userId);
      if (person === null) throw new DeliveryPersonNotLinkedError();

      person.relocate(location, this.clock.now());
      await deliveryPersons.save(person);
      const current = (await dispatchBoard.deliveriesInProgress()).find((delivery) =>
        delivery.deliveryPersonId.equals(person.id),
      );
      return toDeliveryPersonDto(person, current?.orderId.value ?? null);
    });
  }
}
