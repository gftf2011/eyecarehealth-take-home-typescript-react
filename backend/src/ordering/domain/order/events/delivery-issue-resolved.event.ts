import { DomainEvent } from '../../../../shared-kernel/domain';
import type { DeliveryIssueResolution } from '../entities/delivery-issue';
import type { OrderId } from '../order-id';
import { ORDER_AGGREGATE_TYPE } from './order-aggregate-type';

export type DeliveryIssueResolvedPayload = {
  issueId: string;
  resolution: DeliveryIssueResolution;
  /** Quem relatou o problema (a tela dele também muda). */
  deliveryPersonId: string;
};

/** O problema da entrega terminou: nova tentativa, devolução, cancelamento ou entrega. */
export class DeliveryIssueResolved extends DomainEvent<DeliveryIssueResolvedPayload> {
  readonly eventName = 'ordering.order.delivery-issue-resolved';
  readonly aggregateType = ORDER_AGGREGATE_TYPE;

  constructor(orderId: OrderId, occurredAt: Date, payload: DeliveryIssueResolvedPayload) {
    super(orderId.value, occurredAt, payload);
  }
}
