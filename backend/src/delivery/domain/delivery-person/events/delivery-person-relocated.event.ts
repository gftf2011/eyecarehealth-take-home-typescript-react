import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';

export type DeliveryPersonRelocatedPayload = {
  latitude: number | null;
  longitude: number | null;
};

export class DeliveryPersonRelocated extends DomainEvent<DeliveryPersonRelocatedPayload> {
  readonly eventName = 'delivery.delivery-person.relocated';
  readonly aggregateType = DELIVERY_PERSON_AGGREGATE_TYPE;

  constructor(
    deliveryPersonId: DeliveryPersonId,
    occurredAt: Date,
    payload: DeliveryPersonRelocatedPayload,
  ) {
    super(deliveryPersonId.value, occurredAt, payload);
  }
}
