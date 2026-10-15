import type { UnitOfWork } from '../../../shared-kernel/application/index.js';
import type { ProductRepository } from '../../domain/index.js';
import type { ActiveOrdersChecker } from './active-orders-checker.js';

/**
 * O que o Catalog acessa dentro de uma transação: repositórios e as leituras
 * de outros contextos que precisam ser consistentes com as escritas.
 */
export type CatalogRepositories = {
  readonly products: ProductRepository;
  readonly activeOrders: ActiveOrdersChecker;
};

export type CatalogUnitOfWork = UnitOfWork<CatalogRepositories>;
