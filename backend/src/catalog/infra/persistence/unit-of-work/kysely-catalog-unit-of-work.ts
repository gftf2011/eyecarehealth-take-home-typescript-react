import type { Kysely } from 'kysely';

import type {
  CatalogRepositories,
  CatalogUnitOfWork,
} from '../../../application/ports/catalog-unit-of-work';
import type { CatalogDatabase } from '../schema/catalog-database';
import { KyselyActiveOrdersChecker } from '../acl/kysely-active-orders-checker';
import { KyselyProductRepository } from '../repositories/kysely-product.repository';

/**
 * Unit of work do Catalog sobre uma transação do PostgreSQL. Os repositórios
 * são criados já ligados à transação: commit se `work` resolver, rollback se
 * rejeitar (o Kysely relança o erro original).
 */
export class KyselyCatalogUnitOfWork implements CatalogUnitOfWork {
  constructor(private readonly db: Kysely<CatalogDatabase>) {}

  transaction<TResult>(work: (repositories: CatalogRepositories) => Promise<TResult>): Promise<TResult> {
    return this.db.transaction().execute((trx) =>
      work({
        products: new KyselyProductRepository(trx),
        activeOrders: new KyselyActiveOrdersChecker(trx),
      }),
    );
  }
}
