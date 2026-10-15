import type { DeliveryPersonActivationChanged } from './delivery-person-activation-changed.event';
import type { DeliveryPersonRegistered } from './delivery-person-registered.event';
import type { DeliveryPersonRelocated } from './delivery-person-relocated.event';
import type { DeliveryPersonRemoved } from './delivery-person-removed.event';
import type { DeliveryPersonUpdated } from './delivery-person-updated.event';

export {
  DeliveryPersonActivationChanged,
  type DeliveryPersonActivationChangedPayload,
} from './delivery-person-activation-changed.event';
export { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type';
export {
  DeliveryPersonRegistered,
  type DeliveryPersonRegisteredPayload,
} from './delivery-person-registered.event';
export {
  DeliveryPersonRelocated,
  type DeliveryPersonRelocatedPayload,
} from './delivery-person-relocated.event';
export { DeliveryPersonRemoved } from './delivery-person-removed.event';
export {
  DeliveryPersonUpdated,
  type DeliveryPersonDetailField,
  type DeliveryPersonUpdatedPayload,
} from './delivery-person-updated.event';

export type DeliveryPersonDomainEvent =
  | DeliveryPersonRegistered
  | DeliveryPersonUpdated
  | DeliveryPersonActivationChanged
  | DeliveryPersonRelocated
  | DeliveryPersonRemoved;
