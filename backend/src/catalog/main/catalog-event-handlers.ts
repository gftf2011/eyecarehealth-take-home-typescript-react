import type { InMemoryEventMediator } from '../../shared-kernel/infra/events/in-memory-event-mediator';
import { PublishProductUpdateHandler } from '../application/event-handlers/publish-product-update.handler';
import {
  ProductAvailabilityChanged,
  ProductCreated,
  ProductPriceChanged,
  ProductRemoved,
  ProductUpdated,
} from '../domain';

/** Inscreve no mediador os handlers que reagem aos eventos do Catalog. */
export function subscribeCatalogEventHandlers(mediator: InMemoryEventMediator): void {
  const publishProductUpdate = new PublishProductUpdateHandler();
  mediator
    .subscribe(ProductCreated, publishProductUpdate)
    .subscribe(ProductUpdated, publishProductUpdate)
    .subscribe(ProductPriceChanged, publishProductUpdate)
    .subscribe(ProductAvailabilityChanged, publishProductUpdate)
    .subscribe(ProductRemoved, publishProductUpdate);
}
