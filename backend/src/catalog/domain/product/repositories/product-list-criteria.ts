import type { Keyset, Sort, SortKey } from '../../../../shared-kernel/domain';
import type { Product } from '../product';
import type { ProductCategoryValue } from '../value-objects/product-category';

export const PRODUCT_SORT_FIELDS = ['name', 'price', 'createdAt'] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** O valor de cada campo de ordenação que vai no cursor: o nome, centavos e epoch em ms. */
export const PRODUCT_SORT_KEYS: { readonly [TField in ProductSortField]: SortKey<Product> } = {
  name: { kind: 'text', of: (product) => product.name.value },
  price: { kind: 'integer', of: (product) => product.price.amount.cents },
  createdAt: { kind: 'integer', of: (product) => product.createdAt.getTime() },
};

/**
 * Quem está consultando:
 * - `backoffice`: painel (admin/viewer) — vê também produtos indisponíveis.
 * - `public`: listagens públicas — só produtos disponíveis.
 * Produtos removidos (soft delete) nunca aparecem.
 */
export type ProductVisibility = 'backoffice' | 'public';

export type ProductListCriteria = {
  readonly limit: number;
  /** De onde a página começa; `null` = primeira página. */
  readonly keyset: Keyset | null;
  /** Trecho do nome, sem diferenciar maiúsculas/minúsculas. */
  readonly search: string | null;
  readonly category: ProductCategoryValue | null;
  readonly isAvailable: boolean | null;
  /** Desempate pelo ID na mesma direção, para a paginação ser estável. */
  readonly sort: Sort<ProductSortField>;
  readonly visibility: ProductVisibility;
};
