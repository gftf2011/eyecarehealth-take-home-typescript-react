import type { Kysely } from 'kysely';

import { DomainEventBuffer, type EventMediator } from '../../../../shared-kernel/application';
import { publishCollectedEvents } from '../../../../shared-kernel/infra/events/publish-collected-events';
import type {
  DeliveryRepositories,
  DeliveryUnitOfWork,
} from '../../../application/ports/delivery-unit-of-work';
import { KyselyDispatchBoard } from '../acl/kysely-dispatch-board';
import { KyselyDeliveryPersonRepository } from '../repositories/kysely-delivery-person.repository';
import type { DeliveryDatabase } from '../schema/delivery-database';

/**
 * Unit of work do Delivery sobre uma transação do PostgreSQL; publica os
 * eventos coletados no mediador antes do commit (mesma semântica dos outros
 * contextos).
 */
export class KyselyDeliveryUnitOfWork implements DeliveryUnitOfWork {
  constructor(
    private readonly db: Kysely<DeliveryDatabase>,
    private readonly mediator: EventMediator,
  ) {}

  transaction<TResult>(work: (repositories: DeliveryRepositories) => Promise<TResult>): Promise<TResult> {
    return this.db.transaction().execute(async (trx) => {
      const events = new DomainEventBuffer();
      const result = await work({
        deliveryPersons: new KyselyDeliveryPersonRepository(trx, events),
        dispatchBoard: new KyselyDispatchBoard(trx),
      });
      await publishCollectedEvents(this.mediator, events, trx);
      return result;
    });
  }
}
