import { NotFoundError } from '../../../shared-kernel/domain';
import type { DeliveryPersonId } from '../../domain';

/** O entregador referenciado não existe (ou foi removido) no contexto Delivery. */
export class DeliveryPersonNotFoundError extends NotFoundError {
  readonly code = 'DELIVERY_PERSON_NOT_FOUND';

  constructor(deliveryPersonId: DeliveryPersonId) {
    super('Entregador não encontrado', [{ deliveryPersonId: deliveryPersonId.value }]);
  }
}
