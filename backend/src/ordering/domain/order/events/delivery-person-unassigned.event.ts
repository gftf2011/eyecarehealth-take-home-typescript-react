import { DomainEvent } from '../../../../shared-kernel/domain';
import type { OrderId } from '../order-id';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';

export type DeliveryPersonUnassignedPayload = {
  previousDeliveryPersonId: string;
};

/** O pedido voltou a ficar sem entregador (ex.: o atribuído foi desativado). */
export class DeliveryPersonUnassigned extends DomainEvent<DeliveryPersonUnassignedPayload> {
  readonly eventName = 'ordering.order.delivery-person-unassigned';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: DeliveryPersonUnassignedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
