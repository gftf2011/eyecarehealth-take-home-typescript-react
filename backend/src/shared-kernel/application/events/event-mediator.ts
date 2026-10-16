import type { DomainEvent } from '../../domain';
import type { EventHandlingScope } from './domain-event-handler';

/**
 * Mediador de eventos de domínio: recebe os eventos de uma transação e os
 * entrega aos handlers inscritos em cada tipo. Quem publica não conhece quem
 * trata.
 */
export interface EventMediator {
  /** Entrega os eventos, na ordem, a todos os handlers inscritos. */
  publish(events: readonly DomainEvent[], scope: EventHandlingScope): Promise<void>;
}
