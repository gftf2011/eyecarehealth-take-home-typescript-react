import type { Slice } from '../../domain';
import type { PageRequest } from './page-request';

export type Pagination = {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
};

/** Resultado paginado, no formato `{ data, pagination }` da API. */
export type Page<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: Pagination;
};

/** Converte a fatia devolvida pelo repositório em página de saída, mapeando cada item. */
export function toPage<TItem, TOutput>(
  slice: Slice<TItem>,
  request: PageRequest,
  map: (item: TItem) => TOutput,
): Page<TOutput> {
  if (!Number.isSafeInteger(slice.total) || slice.total < 0) {
    throw new RangeError(`Total inválido para paginação: ${slice.total}`);
  }
  if (slice.items.length > request.limit) {
    throw new RangeError('O repositório devolveu mais itens que o limite da página');
  }

  return {
    data: slice.items.map(map),
    pagination: {
      page: request.page,
      limit: request.limit,
      total: slice.total,
      totalPages: Math.ceil(slice.total / request.limit),
    },
  };
}
