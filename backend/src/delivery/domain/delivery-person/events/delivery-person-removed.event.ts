import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';

export class DeliveryPersonRemoved extends DomainEvent<Record<string, never>> {
  readonly eventName = 'delivery.delivery-person.removed';
  readonly aggregateType = DELIVERY_PERSON_AGGREGATE_TYPE;

  constructor(deliveryPersonId: DeliveryPersonId, occurredAt: Date) {
    super(deliveryPersonId.value, occurredAt, {});
  }
}
