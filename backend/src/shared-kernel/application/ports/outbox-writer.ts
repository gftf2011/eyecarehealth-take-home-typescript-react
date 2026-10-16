import type { DomainEvent, JsonObject } from '../../domain';

/**
 * Mensagem de integração destinada a outro sistema. O payload é o contrato
 * público acordado com quem consome, definido pelo handler — não precisa ser
 * o payload interno do evento de domínio.
 */
export type OutboxMessage = {
  /** Idempotência no consumidor: normalmente o `eventId` do evento de origem. */
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  /** Nome estável do tópico/mensagem, ex.: `ordering.order.placed`. */
  readonly eventName: string;
  readonly eventVersion: number;
  readonly payload: JsonObject;
  readonly occurredAt: Date;
};

/**
 * Port do transactional outbox: grava mensagens na **mesma** transação do caso
 * de uso, para que sejam confirmadas ou descartadas junto com as escritas.
 * Um processo à parte as entrega ao sistema externo.
 */
export interface OutboxWriter {
  append(messages: readonly OutboxMessage[]): Promise<void>;
}

/**
 * Monta a mensagem a partir do evento de domínio, com o payload escolhido
 * pelo handler (padrão: o próprio payload do evento).
 */
export function toOutboxMessage(
  event: DomainEvent,
  payload: JsonObject = event.payload,
): OutboxMessage {
  return {
    id: event.eventId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventName: event.eventName,
    eventVersion: event.eventVersion,
    payload,
    occurredAt: event.occurredAt,
  };
}
