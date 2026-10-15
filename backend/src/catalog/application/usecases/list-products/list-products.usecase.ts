import {
  PageRequest,
  parseSortDirection,
  parseSortField,
  toPage,
  validateInput,
  type Page,
  type UseCase,
} from '../../../../shared-kernel/application/index';
import {
  PRODUCT_SORT_FIELDS,
  ProductCategory,
  type ProductListCriteria,
  type ProductVisibility,
} from '../../../domain/index';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { InvalidSearchError } from '../../errors/invalid-search.error';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work';

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
  constructor(private readonly unitOfWork: CatalogUnitOfWork) {}

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
      offset: validated.page.offset,
      limit: validated.page.limit,
      search: validated.search,
      category: validated.category,
      isAvailable: input.isAvailable ?? null,
      sort: { field: validated.sortField, direction: validated.sortDirection },
      visibility: input.visibility ?? 'backoffice',
    };

    return this.unitOfWork.transaction(async ({ products }) =>
      toPage(await products.list(criteria), validated.page, toProductDto),
    );
  }
}

function normalizeSearch(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  if (value.length > MAX_SEARCH_LENGTH) throw new InvalidSearchError(MAX_SEARCH_LENGTH);
  return value;
}
