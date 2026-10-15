import type { UnitOfWork } from '../../../shared-kernel/application/index.js';
import type { ProductRepository } from '../../domain/index.js';

/** Repositórios do Catalog disponíveis dentro de uma transação. */
export type CatalogRepositories = {
  readonly products: ProductRepository;
};

export type CatalogUnitOfWork = UnitOfWork<CatalogRepositories>;
