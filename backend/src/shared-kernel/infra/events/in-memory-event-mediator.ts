import type {
  DomainEventHandler,
  EventHandlingScope,
} from '../../application/events/domain-event-handler';
import type { EventMediator } from '../../application/events/event-mediator';
import type { DomainEvent } from '../../domain';

/** Classe concreta de evento, usada como chave de inscrição. */
export type DomainEventType<TEvent extends DomainEvent> = abstract new (...args: never[]) => TEvent;

type Subscription = (event: DomainEvent, scope: EventHandlingScope) => Promise<void>;

/**
 * Mediador em memória do processo. Os handlers são inscritos por classe de
 * evento no composition root e chamados em sequência, na ordem de inscrição:
 * o primeiro erro interrompe a publicação e desfaz a transação.
 *
 * Eventos sem handler são simplesmente descartados. O que precisa sair do
 * processo é responsabilidade de um handler que grava no outbox.
 */
export class InMemoryEventMediator implements EventMediator {
  readonly #subscriptions: Subscription[] = [];

  subscribe<TEvent extends DomainEvent>(
    eventType: DomainEventType<TEvent>,
    handler: DomainEventHandler<TEvent>,
  ): this {
    this.#subscriptions.push(async (event, scope) => {
      if (event instanceof eventType) await handler.handle(event, scope);
    });
    return this;
  }

  async publish(events: readonly DomainEvent[], scope: EventHandlingScope): Promise<void> {
    for (const event of events) {
      for (const deliver of this.#subscriptions) await deliver(event, scope);
    }
  }
}
