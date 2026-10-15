import {
  PageRequest,
  parseSortDirection,
  parseSortField,
  toPage,
  validateInput,
  type Page,
  type UseCase,
} from '../../../../shared-kernel/application/index';
import { ProductCategory } from '../../../domain/index';
import type { ProductDto } from '../../dtos/product.dto';
import { InvalidSearchError } from '../../errors/invalid-search.error';
import {
  PRODUCT_SORT_FIELDS,
  type ProductListCriteria,
  type ProductQuery,
  type ProductVisibility,
} from '../../queries/product.query';

/** Mesmo tamanho máximo do nome do produto: buscas maiores nunca casariam. */
const MAX_SEARCH_LENGTH = 120;

export type ListProductsInput = {
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
  readonly search?: string | undefined;
  readonly category?: string | undefined;
  readonly isAvailable?: boolean | undefined;
  /** `name`, `price` ou `createdAt` (padrão). */
  readonly sortBy?: string | undefined;
  /** `asc` ou `desc` (padrão). */
  readonly sortOrder?: string | undefined;
  /** Padrão: `backoffice`. */
  readonly visibility?: ProductVisibility | undefined;
};

/** Lista produtos com paginação, busca por nome, filtros e ordenação. */
export class ListProductsUseCase implements UseCase<ListProductsInput, Page<ProductDto>> {
  constructor(private readonly products: ProductQuery) {}

  async execute(input: ListProductsInput): Promise<Page<ProductDto>> {
    const validated = validateInput({
      page: () => PageRequest.create(input.page, input.limit),
      search: () => normalizeSearch(input.search),
      category: () =>
        input.category === undefined ? null : ProductCategory.create(input.category).value,
      sortField: () => parseSortField(input.sortBy, PRODUCT_SORT_FIELDS, 'createdAt'),
      sortDirection: () => parseSortDirection(input.sortOrder, 'desc'),
    });

    const criteria: ProductListCriteria = {
      page: validated.page,
      search: validated.search,
      category: validated.category,
      isAvailable: input.isAvailable ?? null,
      sort: { field: validated.sortField, direction: validated.sortDirection },
      visibility: input.visibility ?? 'backoffice',
    };

    return toPage(await this.products.list(criteria), validated.page);
  }
}

function normalizeSearch(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  if (value.length > MAX_SEARCH_LENGTH) throw new InvalidSearchError(MAX_SEARCH_LENGTH);
  return value;
}
