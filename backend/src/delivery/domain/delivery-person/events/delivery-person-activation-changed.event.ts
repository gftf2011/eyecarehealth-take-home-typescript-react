import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';

export type DeliveryPersonActivationChangedPayload = {
  isActive: boolean;
};

export class DeliveryPersonActivationChanged extends DomainEvent<DeliveryPersonActivationChangedPayload> {
  readonly eventName = 'delivery.delivery-person.activation-changed';
  readonly aggregateType = DELIVERY_PERSON_AGGREGATE_TYPE;

  constructor(
    deliveryPersonId: DeliveryPersonId,
    occurredAt: Date,
    payload: DeliveryPersonActivationChangedPayload,
  ) {
    super(deliveryPersonId.value, occurredAt, payload);
  }
}
