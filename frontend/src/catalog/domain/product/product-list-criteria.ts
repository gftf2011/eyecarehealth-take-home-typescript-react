import type { Sort } from '../../../shared-kernel/domain';
import type { ProductCategoryValue } from './value-objects/product-category';

/** Campos de ordenação aceitos pela API. */
export const PRODUCT_SORT_FIELDS = ['name', 'price', 'createdAt'] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** Mesmo tamanho máximo do nome do produto: buscas maiores nunca casariam (regra da API). */
export const MAX_SEARCH_LENGTH = 120;

/** Busca, filtros, ordenação e página da listagem de produtos, já validados. */
export type ProductListCriteria = {
  readonly page: number;
  readonly limit: number;
  /** Trecho do nome, sem diferenciar maiúsculas. */
  readonly search: string | null;
  readonly category: ProductCategoryValue | null;
  readonly isAvailable: boolean | null;
  readonly sort: Sort<ProductSortField>;
};
