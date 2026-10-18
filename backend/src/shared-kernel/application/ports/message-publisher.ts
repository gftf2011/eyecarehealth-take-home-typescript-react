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
 * O broker está fora do alcance (conexão caiu, recusou etc.): falha
 * **transitória**, de todas as mensagens e não de uma. O relay espera e tenta
 * de novo sem contar tentativa, então uma queda longa não manda nada para a
 * fila morta.
 */
export class BrokerUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Broker de mensagens indisponível', options);
    this.name = 'BrokerUnavailableError';
  }
}

/**
 * Port de saída para o broker de mensagens (Redis pub/sub em produção). Lança
 * se não conseguir publicar: o relay mantém a mensagem pendente e tenta de
 * novo. `BrokerUnavailableError` é queda do broker (transitória); qualquer
 * outro erro é da mensagem (permanente) e conta para a fila morta.
 */
export interface MessagePublisher {
  publish(message: PublishedMessage): Promise<void>;
}
