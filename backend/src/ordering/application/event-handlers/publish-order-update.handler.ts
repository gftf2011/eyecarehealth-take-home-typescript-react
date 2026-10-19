import { toOutboxMessage, type DomainEventHandler, type EventHandlingScope } from '../../../shared-kernel/application';
import { Money } from '../../../shared-kernel/domain';
import {
  DeliveryIssueReported,
  DeliveryIssueResolved,
  DeliveryPersonAssigned,
  DeliveryPersonUnassigned,
  OrderPlaced,
  OrderStatusChanged,
  type OrderDomainEvent,
} from '../../domain';
import {
  ORDER_UPDATES_TOPIC,
  ORDER_UPDATES_VERSION,
  type OrderUpdateMessage,
} from '../messages/order-update.message';

/**
 * Leva as mudanças de pedido para fora do processo: grava no outbox, na mesma
 * transação do caso de uso, a mensagem pública consumida pelo painel em tempo
 * real. Só após o commit o relay a publica, então o painel nunca vê um pedido
 * que sofreu rollback.
 */
export class PublishOrderUpdateHandler implements DomainEventHandler<OrderDomainEvent> {
  async handle(event: OrderDomainEvent, { outbox }: EventHandlingScope): Promise<void> {
    await outbox.append([
      {
        ...toOutboxMessage(event, toOrderUpdate(event)),
        eventName: ORDER_UPDATES_TOPIC,
        eventVersion: ORDER_UPDATES_VERSION,
      },
    ]);
  }
}

function toOrderUpdate(event: OrderDomainEvent): OrderUpdateMessage {
  const base = { orderId: event.aggregateId, occurredAt: event.occurredAt.toISOString() };

  if (event instanceof OrderPlaced) {
    return {
      type: 'order.placed',
      ...base,
      status: 'pending',
      totalAmount: Money.fromCents(event.payload.totalAmountCents).toDecimal(),
    };
  }
  if (event instanceof OrderStatusChanged) {
    return {
      type: 'order.status-changed',
      ...base,
      previousStatus: event.payload.from,
      status: event.payload.to,
      deliveryPersonId: event.payload.deliveryPersonId,
    };
  }
  if (event instanceof DeliveryPersonAssigned) {
    return {
      type: 'order.delivery-person-assigned',
      ...base,
      deliveryPersonId: event.payload.deliveryPersonId,
      previousDeliveryPersonId: event.payload.previousDeliveryPersonId,
    };
  }
  if (event instanceof DeliveryPersonUnassigned) {
    return {
      type: 'order.delivery-person-unassigned',
      ...base,
      previousDeliveryPersonId: event.payload.previousDeliveryPersonId,
    };
  }
  if (event instanceof DeliveryIssueReported) {
    return {
      type: 'order.delivery-issue-reported',
      ...base,
      reason: event.payload.reason,
      deliveryPersonId: event.payload.deliveryPersonId,
    };
  }
  if (event instanceof DeliveryIssueResolved) {
    return {
      type: 'order.delivery-issue-resolved',
      ...base,
      resolution: event.payload.resolution,
      deliveryPersonId: event.payload.deliveryPersonId,
    };
  }
  return assertNever(event);
}

function assertNever(event: never): never {
  throw new Error(`Evento de pedido sem mapeamento: ${JSON.stringify(event)}`);
}
