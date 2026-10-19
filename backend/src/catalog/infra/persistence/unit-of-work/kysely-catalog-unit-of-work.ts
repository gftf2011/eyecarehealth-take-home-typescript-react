import type { Kysely } from 'kysely';

import { DomainEventBuffer, type EventMediator } from '../../../../shared-kernel/application';
import {
  publishCollectedEvents,
  runAfterCommit,
  type AfterCommitEffects,
} from '../../../../shared-kernel/infra/events/publish-collected-events';
import type {
  CatalogRepositories,
  CatalogUnitOfWork,
} from '../../../application/ports/catalog-unit-of-work';
import type { CatalogDatabase } from '../schema/catalog-database';
import { KyselyActiveOrdersChecker } from '../acl/kysely-active-orders-checker';
import { KyselyProductRepository } from '../repositories/kysely-product.repository';

/**
 * Unit of work do Catalog sobre uma transação do PostgreSQL. Os repositórios
 * são criados já ligados à transação; ao fim do trabalho, os eventos coletados
 * são publicados no mediador ainda dentro dela. Commit se tudo resolver,
 * rollback se algo rejeitar (o Kysely relança o erro original).
 */
export class KyselyCatalogUnitOfWork implements CatalogUnitOfWork {
  constructor(
    private readonly db: Kysely<CatalogDatabase>,
    private readonly mediator: EventMediator,
  ) {}

  async transaction<TResult>(work: (repositories: CatalogRepositories) => Promise<TResult>): Promise<TResult> {
    const effects: AfterCommitEffects = [];
    const committed = await this.db.transaction().execute(async (trx) => {
      const events = new DomainEventBuffer();
      const result = await work({
        products: new KyselyProductRepository(trx, events),
        activeOrders: new KyselyActiveOrdersChecker(trx),
      });
      await publishCollectedEvents(this.mediator, events, trx, effects);
      return result;
    });
    // Só com a transação confirmada.
    runAfterCommit(effects);
    return committed;
  }
}
