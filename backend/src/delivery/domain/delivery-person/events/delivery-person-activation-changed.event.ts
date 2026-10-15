import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { DeliveryPersonId } from '../delivery-person-id';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type';

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
