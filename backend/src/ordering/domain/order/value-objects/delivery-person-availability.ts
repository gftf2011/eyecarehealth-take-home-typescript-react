import { ValueObject } from '../../../../shared-kernel/domain';
import type { DeliveryPersonId } from './delivery-person-id';

/**
 * Fato sobre um entregador, trazido do contexto Delivery pela camada
 * anticorrupção no momento da atribuição.
 */
export class DeliveryPersonAvailability extends ValueObject<{
  deliveryPersonId: DeliveryPersonId;
  isActive: boolean;
  hasDeliveryInProgress: boolean;
}> {
  private constructor(
    deliveryPersonId: DeliveryPersonId,
    isActive: boolean,
    hasDeliveryInProgress: boolean,
  ) {
    super({ deliveryPersonId, isActive, hasDeliveryInProgress });
  }

  static create(params: {
    deliveryPersonId: DeliveryPersonId;
    isActive: boolean;
    hasDeliveryInProgress: boolean;
  }): DeliveryPersonAvailability {
    return new DeliveryPersonAvailability(
      params.deliveryPersonId,
      params.isActive,
      params.hasDeliveryInProgress,
    );
  }

  get deliveryPersonId(): DeliveryPersonId {
    return this.props.deliveryPersonId;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get hasDeliveryInProgress(): boolean {
    return this.props.hasDeliveryInProgress;
  }

  get canTakeOrder(): boolean {
    return this.props.isActive && !this.props.hasDeliveryInProgress;
  }
}
