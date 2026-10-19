import { DomainEvent } from '../../../../shared-kernel/domain';
import type { DeliveryIssueReasonValue } from '../value-objects/delivery-issue-reason';
import type { OrderId } from '../order-id';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';

export type DeliveryIssueReportedPayload = {
  issueId: string;
  reason: DeliveryIssueReasonValue;
  deliveryPersonId: string;
};

/** O entregador não conseguiu entregar e relatou o motivo; o gestor decide o que fazer. */
export class DeliveryIssueReported extends DomainEvent<DeliveryIssueReportedPayload> {
  readonly eventName = 'ordering.order.delivery-issue-reported';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: DeliveryIssueReportedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
