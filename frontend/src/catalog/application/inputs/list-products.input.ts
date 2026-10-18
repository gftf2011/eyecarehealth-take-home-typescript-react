import {
  PageRequest,
  collectFieldErrors,
  parseSortDirection,
  parseSortField,
  validateInput,
} from '../../../shared-kernel/application';
import {
  MAX_SEARCH_LENGTH,
  PRODUCT_SORT_FIELDS,
  ProductCategory,
  type ProductListCriteria,
} from '../../domain';
import { InvalidProductFilterError } from '../errors/invalid-product-filter.error';

/** Busca e filtros como chegam da tela (e da URL). */
export type ListProductsInput = {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly search?: string | undefined;
  readonly category?: string | undefined;
  /** `true`, `false` ou vazio (todos). */
  readonly isAvailable?: string | undefined;
  /** `name`, `price` ou `createdAt` (padrão). */
  readonly sortBy?: string | undefined;
  readonly sortOrder?: string | undefined;
};

const present = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

/** Valida tudo de uma vez, com as regras e mensagens da API. */
export function parseListProductsInput(input: ListProductsInput): ProductListCriteria {
  const validated = validateInput({
    page: () => PageRequest.create(input.page, input.limit),
    search: () => {
      const search = present(input.search) ?? null;
      if (search !== null && search.length > MAX_SEARCH_LENGTH) {
        throw new InvalidProductFilterError('search', `A busca deve ter no máximo ${MAX_SEARCH_LENGTH} caracteres`);
      }
      return search;
    },
    category: () => {
      const category = present(input.category);
      return category === undefined ? null : ProductCategory.create(category).value;
    },
    isAvailable: () => parseAvailability(present(input.isAvailable)),
    sortField: () => parseSortField(present(input.sortBy), PRODUCT_SORT_FIELDS, 'createdAt'),
    sortDirection: () => parseSortDirection(present(input.sortOrder), 'desc'),
  });

  return {
    page: validated.page.page,
    limit: validated.page.limit,
    search: validated.search,
    category: validated.category,
    isAvailable: validated.isAvailable,
    sort: { field: validated.sortField, direction: validated.sortDirection },
  };
}

export function listProductsInputErrors(input: ListProductsInput): Readonly<Record<string, string>> {
  return collectFieldErrors(() => parseListProductsInput(input));
}

function parseAvailability(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  throw new InvalidProductFilterError('isAvailable', 'A disponibilidade deve ser true ou false');
}
