import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { OrderId } from '../order-id';
import type { OrderStatusValue } from '../value-objects/order-status';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';

export type OrderStatusChangedPayload = {
  from: OrderStatusValue;
  to: OrderStatusValue;
  deliveryPersonId: string | null;
};

/**
 * Único evento para todas as transições: consumidores filtram por `to`
 * (ex.: Delivery libera o entregador quando `to` é `delivered`).
 */
export class OrderStatusChanged extends DomainEvent<OrderStatusChangedPayload> {
  readonly eventName = 'ordering.order.status-changed';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: OrderStatusChangedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
