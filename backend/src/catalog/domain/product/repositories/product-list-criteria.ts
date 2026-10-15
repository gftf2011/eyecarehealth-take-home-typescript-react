import type { Sort } from '../../../../shared-kernel/domain';
import type { ProductCategoryValue } from '../value-objects/product-category';

export const PRODUCT_SORT_FIELDS = ['name', 'price', 'createdAt'] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/**
 * Quem está consultando:
 * - `backoffice`: painel (admin/viewer) — vê também produtos indisponíveis.
 * - `public`: listagens públicas — só produtos disponíveis.
 * Produtos removidos (soft delete) nunca aparecem.
 */
export type ProductVisibility = 'backoffice' | 'public';

export type ProductListCriteria = {
  readonly offset: number;
  readonly limit: number;
  /** Trecho do nome, sem diferenciar maiúsculas/minúsculas. */
  readonly search: string | null;
  readonly category: ProductCategoryValue | null;
  readonly isAvailable: boolean | null;
  readonly sort: Sort<ProductSortField>;
  readonly visibility: ProductVisibility;
};
