import type { DeliveryPersonAssigned } from './delivery-person-assigned.event.js';
import type { OrderPlaced } from './order-placed.event.js';
import type { OrderStatusChanged } from './order-status-changed.event.js';

export {
  DeliveryPersonAssigned,
  type DeliveryPersonAssignedPayload,
} from './delivery-person-assigned.event.js';
export { ORDER_AGGREGATE_TYPE } from './order-aggregate-type.js';
export {
  OrderPlaced,
  type OrderPlacedItemPayload,
  type OrderPlacedPayload,
} from './order-placed.event.js';
export {
  OrderStatusChanged,
  type OrderStatusChangedPayload,
} from './order-status-changed.event.js';

export type OrderDomainEvent = OrderPlaced | OrderStatusChanged | DeliveryPersonAssigned;
