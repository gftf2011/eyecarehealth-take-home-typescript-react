import { beforeEach, describe, expect, it } from 'vitest';

import type { EventHandlingScope, OutboxMessage } from '../../../shared-kernel/application';
import type { DomainEvent } from '../../../shared-kernel/domain';
import { InMemoryEventMediator } from '../../../shared-kernel/infra/events/in-memory-event-mediator';
import { Product, ProductPrice } from '../../domain';
import {
  buildCreateProductParams,
  buildProduct,
  CREATED_AT,
  LATER,
} from '../../domain/product/testing/product.fixture';
import { subscribeCatalogEventHandlers } from '../../main/catalog-event-handlers';
import { PRODUCT_UPDATES_TOPIC } from '../messages/product-update.message';

describe('PublishProductUpdateHandler (inscrito pelo Catalog no mediador)', () => {
  let appended: OutboxMessage[];
  let scope: EventHandlingScope;
  let mediator: InMemoryEventMediator;

  beforeEach(() => {
    appended = [];
    scope = { outbox: { append: async (messages) => void appended.push(...messages) } };
    mediator = new InMemoryEventMediator();
    subscribeCatalogEventHandlers(mediator);
  });

  async function publish(events: readonly DomainEvent[]): Promise<void> {
    await mediator.publish(events, scope);
  }

  it('grava no outbox a mensagem pública de produto criado', async () => {
    const product = Product.create(buildCreateProductParams());
    const events = product.pullDomainEvents();

    await publish(events);

    expect(appended).toEqual([
      {
        id: events[0]?.eventId,
        aggregateType: 'catalog.product',
        aggregateId: product.id.value,
        eventName: PRODUCT_UPDATES_TOPIC,
        eventVersion: 1,
        payload: {
          type: 'product.created',
          productId: product.id.value,
          occurredAt: CREATED_AT.toISOString(),
        },
        occurredAt: CREATED_AT,
      },
    ]);
  });

  it('publica a mudança de disponibilidade com o novo estado', async () => {
    const product = buildProduct();
    product.makeUnavailable(LATER);

    await publish(product.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      {
        type: 'product.availability-changed',
        productId: product.id.value,
        isAvailable: false,
        occurredAt: LATER.toISOString(),
      },
    ]);
  });

  it('troca de preço publica a edição e a mudança de preço, na ordem', async () => {
    const product = buildProduct();
    product.updateDetails({ price: ProductPrice.fromDecimal(39.9) }, LATER);
    const events = product.pullDomainEvents();

    await publish(events);

    expect(appended.map((message) => message.payload['type'])).toEqual([
      'product.updated',
      'product.price-changed',
    ]);
    expect(appended.map((message) => message.id)).toEqual(events.map((event) => event.eventId));
  });

  it('publica a remoção do produto', async () => {
    const product = buildProduct();
    product.remove({ hasActiveOrders: false, now: LATER });

    await publish(product.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      { type: 'product.removed', productId: product.id.value, occurredAt: LATER.toISOString() },
    ]);
  });
});
