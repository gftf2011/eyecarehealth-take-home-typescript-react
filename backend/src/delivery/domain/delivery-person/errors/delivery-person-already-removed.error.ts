import { BusinessRuleViolationError } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';

export class DeliveryPersonAlreadyRemovedError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_PERSON_REMOVED';

  constructor(deliveryPersonId: DeliveryPersonId) {
    super('O entregador foi removido e não pode mais ser alterado', [
      { deliveryPersonId: deliveryPersonId.value },
    ]);
  }
}
