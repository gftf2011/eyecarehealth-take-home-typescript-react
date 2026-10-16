import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { PublishOrderUpdateHandler } from '../application/event-handlers/publish-order-update.handler';
import { DeliveryPersonAssigned, OrderPlaced, OrderStatusChanged } from '../domain';

/** Inscreve no mediador os handlers que reagem aos eventos do Ordering. */
export function subscribeOrderingEventHandlers(mediator: InMemoryEventMediator): void {
  const publishOrderUpdate = new PublishOrderUpdateHandler();
  mediator
    .subscribe(OrderPlaced, publishOrderUpdate)
    .subscribe(OrderStatusChanged, publishOrderUpdate)
    .subscribe(DeliveryPersonAssigned, publishOrderUpdate);
}
