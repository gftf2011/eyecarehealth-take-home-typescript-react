import { ConflictError } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';

export class DeliveryPersonInUseError extends ConflictError {
  readonly code = 'DELIVERY_PERSON_IN_USE';

  constructor(deliveryPersonId: DeliveryPersonId) {
    super(
      "Não é possível remover este entregador pois ele está atribuído a um pedido com status 'delivering'",
      [{ deliveryPersonId: deliveryPersonId.value }],
    );
  }
}
