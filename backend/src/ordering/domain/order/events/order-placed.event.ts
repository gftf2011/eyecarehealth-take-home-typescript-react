import { DomainEvent } from '../../../../shared-kernel/domain/index.js';
import type { OrderId } from '../order-id.js';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type.js';

export type OrderPlacedItemPayload = {
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderPlacedPayload = {
  totalAmountCents: number;
  items: readonly OrderPlacedItemPayload[];
};

export class OrderPlaced extends DomainEvent<OrderPlacedPayload> {
  readonly eventName = 'ordering.order.placed';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: OrderPlacedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
