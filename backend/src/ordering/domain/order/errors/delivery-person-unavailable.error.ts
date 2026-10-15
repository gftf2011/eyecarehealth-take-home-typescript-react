import { BusinessRuleViolationError } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonAvailability } from '../value-objects/delivery-person-availability.js';

export class DeliveryPersonUnavailableError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_PERSON_UNAVAILABLE';

  constructor(availability: DeliveryPersonAvailability) {
    super(
      availability.isActive
        ? 'Este entregador já está atribuído a outro pedido em andamento'
        : 'Este entregador está inativo',
      [{ deliveryPersonId: availability.deliveryPersonId.value }],
    );
  }
}
