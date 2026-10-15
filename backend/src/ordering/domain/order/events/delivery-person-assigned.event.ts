import { DomainEvent } from '../../../../shared-kernel/domain/index';
import type { OrderId } from '../order-id';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';

export type DeliveryPersonAssignedPayload = {
  deliveryPersonId: string;
  previousDeliveryPersonId: string | null;
};

export class DeliveryPersonAssigned extends DomainEvent<DeliveryPersonAssignedPayload> {
  readonly eventName = 'ordering.order.delivery-person-assigned';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: DeliveryPersonAssignedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
