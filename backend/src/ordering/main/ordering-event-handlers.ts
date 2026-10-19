import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { PublishOrderUpdateHandler } from '../application/event-handlers/publish-order-update.handler';
import { RecordOrderMetricsHandler } from '../application/event-handlers/record-order-metrics.handler';
import type { OrderingMetrics } from '../application/ports/ordering-metrics';
import { DeliveryPersonAssigned, OrderPlaced, OrderStatusChanged } from '../domain';

/** Inscreve no mediador os handlers que reagem aos eventos do Ordering. */
export function subscribeOrderingEventHandlers(mediator: InMemoryEventMediator, metrics: OrderingMetrics): void {
  const publishOrderUpdate = new PublishOrderUpdateHandler();
  const recordMetrics = new RecordOrderMetricsHandler(metrics);
  mediator
    .subscribe(OrderPlaced, publishOrderUpdate)
    .subscribe(OrderStatusChanged, publishOrderUpdate)
    .subscribe(DeliveryPersonAssigned, publishOrderUpdate)
    .subscribe(OrderPlaced, recordMetrics)
    .subscribe(OrderStatusChanged, recordMetrics);
}
