import type { AggregateRoot, DomainEvent, UniqueId } from '../../domain';

/**
 * Acumula os eventos dos agregados salvos durante uma transação. Os
 * repositórios só coletam; a unit of work publica tudo no mediador ao fim do
 * trabalho, antes do commit.
 */
export class DomainEventBuffer {
  #events: DomainEvent[] = [];

  /** Retira os eventos pendentes do agregado. */
  collectFrom(aggregate: AggregateRoot<UniqueId>): void {
    this.#events.push(...aggregate.pullDomainEvents());
  }

  /** Devolve os eventos acumulados, na ordem em que foram salvos, e esvazia o buffer. */
  drain(): readonly DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
