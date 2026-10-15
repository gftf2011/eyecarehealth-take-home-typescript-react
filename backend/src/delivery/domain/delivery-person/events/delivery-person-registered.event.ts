import { DomainEvent } from '../../../../shared-kernel/domain';
import type { DeliveryPersonId } from '../delivery-person-id';
import type { VehicleTypeValue } from '../value-objects/vehicle-type';
import { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type';

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
