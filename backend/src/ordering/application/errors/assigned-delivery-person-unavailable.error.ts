import { BusinessRuleViolationError } from '../../../shared-kernel/domain';
import type { DeliveryPersonId } from '../../domain';

/**
 * O entregador atribuído ao pedido foi removido do Delivery depois da
 * atribuição. Não é 404: o cliente não referenciou o entregador, e sim o
 * pedido, que existe; o que falha é a regra do despacho.
 */
export class AssignedDeliveryPersonUnavailableError extends BusinessRuleViolationError {
  readonly code = 'DELIVERY_PERSON_UNAVAILABLE';

  constructor(deliveryPersonId: DeliveryPersonId) {
    super('O entregador atribuído não está mais disponível', [
      { deliveryPersonId: deliveryPersonId.value },
    ]);
  }
}
