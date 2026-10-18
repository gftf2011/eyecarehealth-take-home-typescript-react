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
 * O que aconteceu com cada mensagem de um lote:
 * - `published`: entregue ao broker;
 * - `broker-unavailable`: o broker estava fora do alcance (rede, throttling,
 *   5xx) — falha **transitória**, de todas e não desta: tentar de novo sem
 *   contar tentativa, para uma queda longa não mandar nada à fila morta;
 * - `rejected`: o broker recusou **esta** mensagem (grande demais, inválida)
 *   — falha **permanente**, que conta para a fila morta;
 * - `deferred`: não foi enviada porque uma anterior do mesmo agregado falhou
 *   nesta rodada — sair antes dela inverteria a ordem (FIFO). Fica pendente,
 *   sem contar tentativa.
 */
export type PublishOutcome =
  | { readonly id: string; readonly status: 'published' }
  | { readonly id: string; readonly status: 'broker-unavailable'; readonly reason: string }
  | { readonly id: string; readonly status: 'rejected'; readonly reason: string }
  | { readonly id: string; readonly status: 'deferred'; readonly reason: string };

/**
 * Port de saída para o broker de mensagens (SNS FIFO em produção). Publica um
 * lote, já na ordem em que as mensagens devem sair, e devolve um resultado por
 * mensagem, na mesma ordem. Garante a ordem **por agregado** (o grupo FIFO) e
 * a deduplicação pelo `id`; uma falha só segura as seguintes do mesmo
 * agregado. Não lança por falha de publicação.
 */
export interface MessagePublisher {
  publishBatch(messages: readonly PublishedMessage[]): Promise<readonly PublishOutcome[]>;
}
