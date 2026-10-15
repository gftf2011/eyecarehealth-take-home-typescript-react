import type { PageRequest, PageSlice, Sort } from '../../../shared-kernel/application/index';
import type { ProductCategoryValue, ProductId } from '../../domain/index';
import type { ProductDto } from '../dtos/product.dto';

export const PRODUCT_SORT_FIELDS = ['name', 'price', 'createdAt'] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/**
 * Quem está consultando:
 * - `backoffice`: painel admin/viewer — vê produtos indisponíveis também.
 * - `public`: listagens públicas — só produtos disponíveis.
 * Produtos removidos (soft delete) nunca aparecem.
 */
export type ProductVisibility = 'backoffice' | 'public';

export type ProductListCriteria = {
  readonly page: PageRequest;
  /** Trecho do nome, sem diferenciar maiúsculas/minúsculas. */
  readonly search: string | null;
  readonly category: ProductCategoryValue | null;
  readonly isAvailable: boolean | null;
  readonly sort: Sort<ProductSortField>;
  readonly visibility: ProductVisibility;
};

/**
 * Port de leitura do Catalog (lado de consulta do CQRS): devolve DTOs direto
 * da base, sem reidratar agregados, para atender às listagens com folga.
 * Não participa da unit of work — consultas não alteram estado.
 */
export interface ProductQuery {
  /** Produto não removido com o ID informado, ou `null`. */
  findById(id: ProductId): Promise<ProductDto | null>;

  list(criteria: ProductListCriteria): Promise<PageSlice<ProductDto>>;
}
