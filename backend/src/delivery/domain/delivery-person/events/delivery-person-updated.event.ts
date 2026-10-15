import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';

export type DeliveryPersonDetailField = 'name' | 'phone' | 'vehicleType';

export type DeliveryPersonUpdatedPayload = {
  changedFields: readonly DeliveryPersonDetailField[];
};

export class DeliveryPersonUpdated extends DomainEvent<DeliveryPersonUpdatedPayload> {
  readonly eventName = 'delivery.delivery-person.updated';
  readonly aggregateType = DELIVERY_PERSON_AGGREGATE_TYPE;

  constructor(
    deliveryPersonId: DeliveryPersonId,
    occurredAt: Date,
    payload: DeliveryPersonUpdatedPayload,
  ) {
    super(deliveryPersonId.value, occurredAt, payload);
  }
}
