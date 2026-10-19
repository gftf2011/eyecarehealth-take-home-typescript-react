import {
  CursorPageRequest,
  parsePageLimit,
  parseSortDirection,
  parseSortField,
  readCursorPage,
  validateInput,
  type Page,
  type UseCase,
} from '../../../../shared-kernel/application';
import {
  PRODUCT_SORT_FIELDS,
  PRODUCT_SORT_KEYS,
  ProductCategory,
  type ProductVisibility,
} from '../../../domain';
import { toProductDto, type ProductDto } from '../../dtos/product.dto';
import { InvalidSearchError } from '../../errors/invalid-search.error';
import type { CatalogUnitOfWork } from '../../ports/catalog-unit-of-work';

/** Mesmo tamanho máximo do nome do produto: buscas maiores nunca casariam. */
const MAX_SEARCH_LENGTH = 120;

export type ListProductsInput = {
  /** `nextCursor` ou `previousCursor` de uma resposta anterior; sem ele, a primeira página. */
  readonly cursor?: string | undefined;
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

/** Lista produtos com paginação por cursor, busca por nome, filtros e ordenação. */
export class ListProductsUseCase implements UseCase<ListProductsInput, Page<ProductDto>> {
  constructor(private readonly unitOfWork: CatalogUnitOfWork) {}

  async execute(input: ListProductsInput): Promise<Page<ProductDto>> {
    const validated = validateInput({
      limit: () => parsePageLimit(input.limit),
      search: () => normalizeSearch(input.search),
      category: () =>
        input.category === undefined ? null : ProductCategory.create(input.category).value,
      sortField: () => parseSortField(input.sortBy, PRODUCT_SORT_FIELDS, 'createdAt'),
      sortDirection: () => parseSortDirection(input.sortOrder, 'desc'),
    });
    const sortKey = PRODUCT_SORT_KEYS[validated.sortField];
    const { page } = validateInput({
      page: () =>
        CursorPageRequest.create(
          { field: validated.sortField, direction: validated.sortDirection },
          validated.limit,
          input.cursor,
          sortKey,
        ),
    });

    return this.unitOfWork.transaction(async ({ products }) =>
      readCursorPage(
        page,
        sortKey,
        (keyset) =>
          products.list({
            limit: page.limit,
            keyset,
            search: validated.search,
            category: validated.category,
            isAvailable: input.isAvailable ?? null,
            sort: page.sort,
            visibility: input.visibility ?? 'backoffice',
          }),
        (items) => items.map(toProductDto),
      ),
    );
  }
}

function normalizeSearch(raw: string | undefined): string | null {
  const value = raw?.trim() ?? '';
  if (value === '') return null;
  if (value.length > MAX_SEARCH_LENGTH) throw new InvalidSearchError(MAX_SEARCH_LENGTH);
  return value;
}
