import { beforeEach, describe, expect, it } from 'vitest';

import type { EventHandlingScope, OutboxMessage } from '../../../shared-kernel/application';
import type { DomainEvent } from '../../../shared-kernel/domain';
import { InMemoryEventMediator } from '../../../shared-kernel/infra/events/in-memory-event-mediator';
import { Order, OrderStatus, ReturnReason } from '../../domain';
import {
  availableCourier,
  buildOrderIn,
  buildPlaceOrderParams,
  COURIER_ID,
  LATER,
  PLACED_AT,
} from '../../domain/order/testing/order.fixture';
import { RecordingOrderingMetrics } from '../testing/recording-ordering-metrics';
import { subscribeOrderingEventHandlers } from '../../main/ordering-event-handlers';
import { ORDER_UPDATES_TOPIC } from '../messages/order-update.message';

const OTHER_COURIER_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('PublishOrderUpdateHandler (inscrito pelo Ordering no mediador)', () => {
  let appended: OutboxMessage[];
  let scope: EventHandlingScope;
  let mediator: InMemoryEventMediator;

  beforeEach(() => {
    appended = [];
    scope = { outbox: { append: async (messages) => void appended.push(...messages) }, afterCommit: () => undefined };
    mediator = new InMemoryEventMediator();
    subscribeOrderingEventHandlers(mediator, new RecordingOrderingMetrics());
  });

  async function publish(events: readonly DomainEvent[]): Promise<void> {
    await mediator.publish(events, scope);
  }

  it('grava no outbox a mensagem pública de pedido criado', async () => {
    const order = Order.place(buildPlaceOrderParams());
    const events = order.pullDomainEvents();

    await publish(events);

    expect(appended).toEqual([
      {
        id: events[0]?.eventId,
        aggregateType: 'ordering.order',
        aggregateId: order.id.value,
        eventName: ORDER_UPDATES_TOPIC,
        eventVersion: 1,
        payload: {
          type: 'order.placed',
          orderId: order.id.value,
          status: 'pending',
          totalAmount: 78.3,
          occurredAt: PLACED_AT.toISOString(),
        },
        occurredAt: PLACED_AT,
      },
    ]);
  });

  it('publica a mudança de status com o status anterior e o entregador', async () => {
    const order = buildOrderIn('delivering');
    order.changeStatus(OrderStatus.of('delivered'), LATER);

    await publish(order.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      {
        type: 'order.status-changed',
        orderId: order.id.value,
        previousStatus: 'delivering',
        status: 'delivered',
        deliveryPersonId: COURIER_ID,
        occurredAt: LATER.toISOString(),
      },
    ]);
  });

  it('publica a troca de entregador', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    order.assignDeliveryPerson(availableCourier(OTHER_COURIER_ID), LATER);

    await publish(order.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      expect.objectContaining({
        type: 'order.delivery-person-assigned',
        deliveryPersonId: COURIER_ID,
        previousDeliveryPersonId: null,
      }),
      expect.objectContaining({
        type: 'order.delivery-person-assigned',
        deliveryPersonId: OTHER_COURIER_ID,
        previousDeliveryPersonId: COURIER_ID,
      }),
    ]);
  });

  it('publica a perda do entregador (desativado ou removido): o pedido volta para a atribuição', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    order.pullDomainEvents();
    order.releaseDeliveryPerson(LATER);

    await publish(order.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      {
        type: 'order.delivery-person-unassigned',
        orderId: order.id.value,
        previousDeliveryPersonId: COURIER_ID,
        occurredAt: LATER.toISOString(),
      },
    ]);
  });

  it('entrega devolvida pelo gestor: mudança de status sem entregador e a perda do entregador', async () => {
    const order = buildOrderIn('delivering');
    order.returnToAssignment(ReturnReason.create('Entregador sem contato'), LATER);

    await publish(order.pullDomainEvents());

    expect(appended.map((message) => message.payload)).toEqual([
      expect.objectContaining({ type: 'order.status-changed', previousStatus: 'delivering', status: 'ready', deliveryPersonId: null }),
      expect.objectContaining({ type: 'order.delivery-person-unassigned', previousDeliveryPersonId: COURIER_ID }),
    ]);
  });

  it('usa o eventId como id da mensagem (idempotência) e mantém a ordem dos eventos', async () => {
    const order = buildOrderIn('ready');
    order.assignDeliveryPerson(availableCourier(), LATER);
    order.dispatch(availableCourier(), LATER);
    const events = order.pullDomainEvents();

    await publish(events);

    expect(appended.map((message) => message.id)).toEqual(events.map((event) => event.eventId));
    expect(appended.map((message) => message.payload['type'])).toEqual([
      'order.delivery-person-assigned',
      'order.status-changed',
    ]);
  });

  it('não expõe dados pessoais do cliente na mensagem', async () => {
    const order = Order.place(buildPlaceOrderParams());

    await publish(order.pullDomainEvents());

    const serialized = JSON.stringify(appended);
    expect(serialized).not.toContain('Joao Silva');
    expect(serialized).not.toContain('(11) 99999-1234');
    expect(serialized).not.toContain('Rua das Flores');
  });
});
