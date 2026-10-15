import { NotFoundError } from '../../../../shared-kernel/domain/index';

export class DeliveryPersonNotFoundError extends NotFoundError {
  readonly code = 'DELIVERY_PERSON_NOT_FOUND';

  constructor(deliveryPersonId: string) {
    super('Entregador não encontrado', [{ deliveryPersonId }]);
  }
}
