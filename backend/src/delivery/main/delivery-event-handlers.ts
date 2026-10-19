import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { PublishDeliveryPersonUpdateHandler } from '../application/event-handlers/publish-delivery-person-update.handler';
import {
  DeliveryPersonActivationChanged,
  DeliveryPersonRegistered,
  DeliveryPersonRelocated,
  DeliveryPersonRemoved,
  DeliveryPersonUpdated,
} from '../domain';

/** Inscreve no mediador os handlers que reagem aos eventos do Delivery. */
export function subscribeDeliveryEventHandlers(mediator: InMemoryEventMediator): void {
  const publishDeliveryPersonUpdate = new PublishDeliveryPersonUpdateHandler();
  mediator
    .subscribe(DeliveryPersonRegistered, publishDeliveryPersonUpdate)
    .subscribe(DeliveryPersonUpdated, publishDeliveryPersonUpdate)
    .subscribe(DeliveryPersonActivationChanged, publishDeliveryPersonUpdate)
    .subscribe(DeliveryPersonRelocated, publishDeliveryPersonUpdate)
    .subscribe(DeliveryPersonRemoved, publishDeliveryPersonUpdate);
}
