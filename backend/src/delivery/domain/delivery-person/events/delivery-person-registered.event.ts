import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { DeliveryPersonId } from '../delivery-person-id.js';
import type { VehicleTypeValue } from '../value-objects/vehicle-type.js';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';

export type DeliveryPersonRegisteredPayload = {
  name: string;
  vehicleType: VehicleTypeValue;
  isActive: boolean;
};

export class DeliveryPersonRegistered extends DomainEvent<DeliveryPersonRegisteredPayload> {
  readonly eventName = 'delivery.delivery-person.registered';
  readonly aggregateType = DELIVERY_PERSON_AGGREGATE_TYPE;

  constructor(
    deliveryPersonId: DeliveryPersonId,
    occurredAt: Date,
    payload: DeliveryPersonRegisteredPayload,
  ) {
    super(deliveryPersonId.value, occurredAt, payload);
  }
}
