import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';
import type { UniqueId } from './unique-id.js';

/**
 * Raiz de agregado: único ponto de entrada para alterar o agregado. Registra os
 * eventos de domínio, que a camada de persistência retira com
 * `pullDomainEvents()` e grava no outbox na mesma transação.
 */
export abstract class AggregateRoot<TId extends UniqueId> extends Entity<TId> {
  #domainEvents: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return [...this.#domainEvents];
  }

  pullDomainEvents(): readonly DomainEvent[] {
    const events = this.#domainEvents;
    this.#domainEvents = [];
    return events;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this.#domainEvents.push(event);
  }
}
