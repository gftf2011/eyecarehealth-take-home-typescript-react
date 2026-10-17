import type { JsonObject } from '../../domain';

/** Mensagem de integração já confirmada no outbox, pronta para sair do processo. */
export type PublishedMessage = {
  /** Chave de idempotência para quem consome (o `eventId` de origem). */
  readonly id: string;
  /** Tópico/nome estável, ex.: `ordering.order-updates`. */
  readonly topic: string;
  readonly version: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: JsonObject;
  readonly occurredAt: Date;
};

/**
 * Port de saída para o broker de mensagens (Redis pub/sub em produção). Lança
 * se não conseguir publicar: o relay mantém a mensagem pendente e tenta de novo.
 */
export interface MessagePublisher {
  publish(message: PublishedMessage): Promise<void>;
}
