import type { DeliveryPersonActivationChanged } from './delivery-person-activation-changed.event.js';
import type { DeliveryPersonRegistered } from './delivery-person-registered.event.js';
import type { DeliveryPersonRelocated } from './delivery-person-relocated.event.js';
import type { DeliveryPersonRemoved } from './delivery-person-removed.event.js';
import type { DeliveryPersonUpdated } from './delivery-person-updated.event.js';

export {
  DeliveryPersonActivationChanged,
  type DeliveryPersonActivationChangedPayload,
} from './delivery-person-activation-changed.event.js';
export { DELIVERY_PERSON_AGGREGATE_TYPE } from './delivery-person-aggregate-type.js';
export {
  DeliveryPersonRegistered,
  type DeliveryPersonRegisteredPayload,
} from './delivery-person-registered.event.js';
export {
  DeliveryPersonRelocated,
  type DeliveryPersonRelocatedPayload,
} from './delivery-person-relocated.event.js';
export { DeliveryPersonRemoved } from './delivery-person-removed.event.js';
export {
  DeliveryPersonUpdated,
  type DeliveryPersonDetailField,
  type DeliveryPersonUpdatedPayload,
} from './delivery-person-updated.event.js';

export type DeliveryPersonDomainEvent =
  | DeliveryPersonRegistered
  | DeliveryPersonUpdated
  | DeliveryPersonActivationChanged
  | DeliveryPersonRelocated
  | DeliveryPersonRemoved;
