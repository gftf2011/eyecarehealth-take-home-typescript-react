import type { Kysely, Transaction } from 'kysely';

import type { DomainEventBuffer, EventMediator } from '../../application';
import type { OutboxDatabase } from '../outbox/outbox-events.table';
import { KyselyOutboxWriter } from '../outbox/kysely-outbox.writer';

/**
 * Publica no mediador os eventos coletados durante a transação, ainda dentro
 * dela: os handlers usam a mesma transação (ex.: outbox) e um erro deles
 * desfaz o caso de uso inteiro. Chamado pelas units of work antes do commit.
 */
export async function publishCollectedEvents(
  mediator: EventMediator,
  events: DomainEventBuffer,
  trx: Transaction<OutboxDatabase> | Kysely<OutboxDatabase>,
): Promise<void> {
  await mediator.publish(events.drain(), { outbox: new KyselyOutboxWriter(trx) });
}
