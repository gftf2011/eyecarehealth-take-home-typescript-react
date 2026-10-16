import type { DomainEvent } from '../../domain';
import type { OutboxWriter } from '../ports/outbox-writer';

/**
 * O que um handler pode usar durante o tratamento: recursos já ligados à
 * transação do caso de uso que originou o evento.
 */
export type EventHandlingScope = {
  /** Para eventos que precisam chegar a outro sistema. */
  readonly outbox: OutboxWriter;
};

/**
 * Reação a um evento de domínio. Roda dentro da transação do caso de uso,
 * antes do commit: se falhar, o caso de uso inteiro é desfeito.
 */
export interface DomainEventHandler<TEvent extends DomainEvent> {
  handle(event: TEvent, scope: EventHandlingScope): Promise<void>;
}
