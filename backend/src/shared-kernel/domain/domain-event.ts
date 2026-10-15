import { randomUUID } from 'node:crypto';

import type { JsonObject } from './json';

/**
 * Fato de negócio já ocorrido. O payload é JSON puro porque o evento é gravado
 * no outbox, na mesma transação do agregado, e despachado depois.
 */
export abstract class DomainEvent<TPayload extends JsonObject = JsonObject> {
  /** Nome estável, no formato `<contexto>.<agregado>.<fato>`. */
  abstract readonly eventName: string;
  abstract readonly aggregateType: string;
  /** Versão do schema do payload, para evoluir consumidores do outbox. */
  readonly eventVersion: number = 1;

  readonly eventId: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<TPayload>;

  protected constructor(aggregateId: string, occurredAt: Date, payload: TPayload) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.occurredAt = new Date(occurredAt.getTime());
    this.payload = Object.freeze({ ...payload });
  }
}
