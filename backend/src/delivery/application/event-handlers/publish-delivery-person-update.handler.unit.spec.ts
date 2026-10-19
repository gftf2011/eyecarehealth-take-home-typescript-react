import { beforeEach, describe, expect, it } from 'vitest';

import type { EventHandlingScope, OutboxMessage } from '../../../shared-kernel/application';
import type { DomainEvent } from '../../../shared-kernel/domain';
import { InMemoryEventMediator } from '../../../shared-kernel/infra/events/in-memory-event-mediator';
import { DeliveryPerson, GeoPoint, PhoneNumber } from '../../domain';
import {
  buildDeliveryPerson,
  buildRegisterParams,
  LATER,
  REGISTERED_AT,
} from '../../domain/delivery-person/testing/delivery-person.fixture';
import { subscribeDeliveryEventHandlers } from '../../main/delivery-event-handlers';
import { DELIVERY_PERSON_UPDATES_TOPIC } from '../messages/delivery-person-update.message';

describe('PublishDeliveryPersonUpdateHandler (inscrito pelo Delivery no mediador)', () => {
  let appended: OutboxMessage[];
  let scope: EventHandlingScope;
  let mediator: InMemoryEventMediator;

  beforeEach(() => {
    appended = [];
    scope = { outbox: { append: async (messages) => void appended.push(...messages) }, afterCommit: () => undefined };
    mediator = new InMemoryEventMediator();
    subscribeDeliveryEventHandlers(mediator);
  });

  async function publish(events: readonly DomainEvent[]): Promise<void> {
    await mediator.publish(events, scope);
  }

  it('grava no outbox a mensagem pública de entregador cadastrado', async () => {
    const person = DeliveryPerson.register(buildRegisterParams());
    const events = person.pullDomainEvents();

    await publish(events);

    expect(appended).toEqual([
      {
        id: events[0]?.eventId,
        aggregateType: 'delivery.delivery-person',
        aggregateId: person.id.value,
        eventName: DELIVERY_PERSON_UPDATES_TOPIC,
        eventVersion: 1,
        payload: {
          type: 'delivery-person.registered',
          deliveryPersonId: person.id.value,
          occurredAt: REGISTERED_AT.toISOString(),
        },
        occurredAt: REGISTERED_AT,
      },
    ]);
  });

  it('a mensagem não leva dados pessoais: o canal é o mesmo para todos os perfis', async () => {
    const person = buildDeliveryPerson();
    person.updateDetails({ phone: PhoneNumber.create('(21) 99876-5432') }, LATER);
    person.relocate(GeoPoint.create(-22.9, -43.2), LATER);

    await publish(person.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      { type: 'delivery-person.updated', deliveryPersonId: person.id.value, occurredAt: LATER.toISOString() },
      { type: 'delivery-person.relocated', deliveryPersonId: person.id.value, occurredAt: LATER.toISOString() },
    ]);
  });

  it('publica a desativação com o novo estado', async () => {
    const person = buildDeliveryPerson();
    person.deactivate(LATER);

    await publish(person.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      {
        type: 'delivery-person.activation-changed',
        deliveryPersonId: person.id.value,
        isActive: false,
        occurredAt: LATER.toISOString(),
      },
    ]);
  });

  it('publica a remoção do entregador', async () => {
    const person = buildDeliveryPerson();
    person.remove({ hasDeliveryInProgress: false, now: LATER });

    await publish(person.pullDomainEvents());

    expect(appended.map((message) => message.payload['type'])).toEqual(['delivery-person.removed']);
  });
});
