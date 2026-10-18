import { toOutboxMessage, type DomainEventHandler, type EventHandlingScope } from '../../../shared-kernel/application';
import {
  ProductAvailabilityChanged,
  ProductCreated,
  ProductPriceChanged,
  ProductRemoved,
  ProductUpdated,
  type ProductDomainEvent,
} from '../../domain';
import {
  PRODUCT_UPDATES_TOPIC,
  PRODUCT_UPDATES_VERSION,
  type ProductUpdateMessage,
} from '../messages/product-update.message';

/**
 * Leva as mudanças do cardápio para fora do processo: grava no outbox, na
 * mesma transação do caso de uso, a mensagem pública que o painel em tempo
 * real consome. Só após o commit o relay a publica.
 */
export class PublishProductUpdateHandler implements DomainEventHandler<ProductDomainEvent> {
  async handle(event: ProductDomainEvent, { outbox }: EventHandlingScope): Promise<void> {
    await outbox.append([
      {
        ...toOutboxMessage(event, toProductUpdate(event)),
        eventName: PRODUCT_UPDATES_TOPIC,
        eventVersion: PRODUCT_UPDATES_VERSION,
      },
    ]);
  }
}

function toProductUpdate(event: ProductDomainEvent): ProductUpdateMessage {
  const base = { productId: event.aggregateId, occurredAt: event.occurredAt.toISOString() };

  if (event instanceof ProductAvailabilityChanged) {
    return { type: 'product.availability-changed', ...base, isAvailable: event.payload.isAvailable };
  }
  if (event instanceof ProductCreated) return { type: 'product.created', ...base };
  if (event instanceof ProductUpdated) return { type: 'product.updated', ...base };
  if (event instanceof ProductPriceChanged) return { type: 'product.price-changed', ...base };
  if (event instanceof ProductRemoved) return { type: 'product.removed', ...base };
  return assertNever(event);
}

function assertNever(event: never): never {
  throw new Error(`Evento de produto sem mapeamento: ${JSON.stringify(event)}`);
}
