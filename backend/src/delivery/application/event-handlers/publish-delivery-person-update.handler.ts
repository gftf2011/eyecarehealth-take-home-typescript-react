import { toOutboxMessage, type DomainEventHandler, type EventHandlingScope } from '../../../shared-kernel/application';
import {
  DeliveryPersonActivationChanged,
  DeliveryPersonRegistered,
  DeliveryPersonRelocated,
  DeliveryPersonRemoved,
  DeliveryPersonUpdated,
  type DeliveryPersonDomainEvent,
} from '../../domain';
import {
  DELIVERY_PERSON_UPDATES_TOPIC,
  DELIVERY_PERSON_UPDATES_VERSION,
  type DeliveryPersonUpdateMessage,
} from '../messages/delivery-person-update.message';

/**
 * Leva as mudanças nos entregadores para fora do processo: grava no outbox,
 * na mesma transação do caso de uso, a mensagem pública que o painel em
 * tempo real consome. Só após o commit o relay a publica.
 */
export class PublishDeliveryPersonUpdateHandler implements DomainEventHandler<DeliveryPersonDomainEvent> {
  async handle(event: DeliveryPersonDomainEvent, { outbox }: EventHandlingScope): Promise<void> {
    await outbox.append([
      {
        ...toOutboxMessage(event, toDeliveryPersonUpdate(event)),
        eventName: DELIVERY_PERSON_UPDATES_TOPIC,
        eventVersion: DELIVERY_PERSON_UPDATES_VERSION,
      },
    ]);
  }
}

function toDeliveryPersonUpdate(event: DeliveryPersonDomainEvent): DeliveryPersonUpdateMessage {
  const base = { deliveryPersonId: event.aggregateId, occurredAt: event.occurredAt.toISOString() };

  if (event instanceof DeliveryPersonActivationChanged) {
    return { type: 'delivery-person.activation-changed', ...base, isActive: event.payload.isActive };
  }
  if (event instanceof DeliveryPersonRegistered) return { type: 'delivery-person.registered', ...base };
  if (event instanceof DeliveryPersonUpdated) return { type: 'delivery-person.updated', ...base };
  if (event instanceof DeliveryPersonRelocated) return { type: 'delivery-person.relocated', ...base };
  if (event instanceof DeliveryPersonRemoved) return { type: 'delivery-person.removed', ...base };
  return assertNever(event);
}

function assertNever(event: never): never {
  throw new Error(`Evento de entregador sem mapeamento: ${JSON.stringify(event)}`);
}
