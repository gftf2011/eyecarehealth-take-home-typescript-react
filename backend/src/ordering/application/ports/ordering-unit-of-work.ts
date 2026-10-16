import type { UnitOfWork } from '../../../shared-kernel/application';
import type { OrderRepository } from '../../domain';
import type { ProductCatalog } from './product-catalog';

/**
 * O que o Ordering acessa dentro de uma transação: repositórios e as leituras
 * de outros contextos que precisam ser consistentes com as escritas.
 */
export type OrderingRepositories = {
  readonly orders: OrderRepository;
  readonly products: ProductCatalog;
};

export type OrderingUnitOfWork = UnitOfWork<OrderingRepositories>;
