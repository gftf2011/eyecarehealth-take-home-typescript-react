import type { PublishedMessage } from '../../application';

/**
 * Corpo de toda mensagem que sai do outbox, igual em qualquer broker (SNS →
 * SQS → Redis): é o que o gateway repassa aos clientes.
 */
export type MessageEnvelope = {
  readonly id: string;
  readonly topic: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly payload: PublishedMessage['payload'];
};

export function toMessageEnvelope(message: PublishedMessage): MessageEnvelope {
  return {
    id: message.id,
    topic: message.topic,
    version: message.version,
    aggregateId: message.aggregateId,
    occurredAt: message.occurredAt.toISOString(),
    payload: message.payload,
  };
}
