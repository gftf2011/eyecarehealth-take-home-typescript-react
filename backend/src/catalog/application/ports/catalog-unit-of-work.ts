import type { UnitOfWork } from '../../../shared-kernel/application/index';
import type { ProductRepository } from '../../domain/index';
import type { ActiveOrdersChecker } from './active-orders-checker';

/**
 * O que o Catalog acessa dentro de uma transação: repositórios e as leituras
 * de outros contextos que precisam ser consistentes com as escritas.
 */
export type CatalogRepositories = {
  readonly products: ProductRepository;
  readonly activeOrders: ActiveOrdersChecker;
};

export type CatalogUnitOfWork = UnitOfWork<CatalogRepositories>;
