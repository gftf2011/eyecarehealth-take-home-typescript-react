import type { Repository, Slice } from '../../../../shared-kernel/domain/index';
import type { Product } from '../product';
import type { ProductListCriteria } from './product-list-criteria';

/**
 * Repositório do agregado Product: escrita e leitura passam por ele.
 * `findById` e `list` nunca devolvem produtos removidos.
 */
export interface ProductRepository extends Repository<Product> {
  /** Página de produtos que atendem aos critérios, com o total geral. */
  list(criteria: ProductListCriteria): Promise<Slice<Product>>;
}
