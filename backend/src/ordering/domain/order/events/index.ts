import type { DeliveryPersonAssigned } from './delivery-person-assigned.event';
import type { DeliveryPersonUnassigned } from './delivery-person-unassigned.event';
import type { OrderPlaced } from './order-placed.event';
import type { OrderStatusChanged } from './order-status-changed.event';

export {
  DeliveryPersonAssigned,
  type DeliveryPersonAssignedPayload,
} from './delivery-person-assigned.event';
export {
  DeliveryPersonUnassigned,
  type DeliveryPersonUnassignedPayload,
} from './delivery-person-unassigned.event';
export { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';
export {
  OrderPlaced,
  type OrderPlacedItemPayload,
  type OrderPlacedPayload,
} from './order-placed.event';
export {
  OrderStatusChanged,
  type OrderStatusChangedPayload,
} from './order-status-changed.event';

export type OrderDomainEvent =
  | OrderPlaced
  | OrderStatusChanged
  | DeliveryPersonAssigned
  | DeliveryPersonUnassigned;
