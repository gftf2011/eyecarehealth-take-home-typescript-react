import type { DomainEvent } from '../../domain';
import type { EventHandlingScope } from '../events/domain-event-handler';
import type { EventMediator } from '../events/event-mediator';

/**
 * Mediador de teste: registra cada evento publicado e, opcionalmente, executa
 * uma reação dentro do escopo da transação (ex.: gravar no outbox ou falhar),
 * para verificar a atomicidade entre o caso de uso e os handlers.
 */
export class RecordingEventMediator implements EventMediator {
  readonly published: DomainEvent[] = [];
  #react: ((event: DomainEvent, scope: EventHandlingScope) => Promise<void>) | null = null;

  /** Reação aplicada a cada evento publicado, como um handler inscrito em todos. */
  reactWith(react: (event: DomainEvent, scope: EventHandlingScope) => Promise<void>): void {
    this.#react = react;
  }

  get publishedNames(): string[] {
    return this.published.map((event) => event.eventName);
  }

  async publish(events: readonly DomainEvent[], scope: EventHandlingScope): Promise<void> {
    for (const event of events) {
      this.published.push(event);
      await this.#react?.(event, scope);
    }
  }
}
