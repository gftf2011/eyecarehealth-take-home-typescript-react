import type { Kysely } from 'kysely';

import { DomainEventBuffer, type EventMediator } from '../../../../shared-kernel/application';
import {
  publishCollectedEvents,
  runAfterCommit,
  type AfterCommitEffects,
} from '../../../../shared-kernel/infra/events/publish-collected-events';
import type {
  OrderingRepositories,
  OrderingUnitOfWork,
} from '../../../application/ports/ordering-unit-of-work';
import { KyselyDeliveryPersonDirectory } from '../acl/kysely-delivery-person-directory';
import { KyselyProductCatalog } from '../acl/kysely-product-catalog';
import { KyselyOrderRepository } from '../repositories/kysely-order.repository';
import type { OrderingDatabase } from '../schema/ordering-database';

/**
 * Unit of work do Ordering sobre uma transação do PostgreSQL. Repositório e
 * ACLs usam a mesma transação, então os locks dos produtos e do entregador
 * valem até o commit; os eventos coletados são publicados no mediador antes
 * dele (mesma semântica dos outros contextos).
 *
 * Ordem de lock em todos os casos de uso: pedido → entregador (ou produtos),
 * o que evita deadlock entre eles.
 */
export class KyselyOrderingUnitOfWork implements OrderingUnitOfWork {
  constructor(
    private readonly db: Kysely<OrderingDatabase>,
    private readonly mediator: EventMediator,
  ) {}

  async transaction<TResult>(work: (repositories: OrderingRepositories) => Promise<TResult>): Promise<TResult> {
    const effects: AfterCommitEffects = [];
    const committed = await this.db.transaction().execute(async (trx) => {
      const events = new DomainEventBuffer();
      const result = await work({
        orders: new KyselyOrderRepository(trx, events),
        products: new KyselyProductCatalog(trx),
        deliveryPersons: new KyselyDeliveryPersonDirectory(trx),
      });
      await publishCollectedEvents(this.mediator, events, trx, effects);
      return result;
    });
    // Só com a transação confirmada.
    runAfterCommit(effects);
    return committed;
  }
}
