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

/** Resultado bruto de uma consulta paginada: os itens da página e o total geral. */
export type PageSlice<TItem> = {
  readonly items: readonly TItem[];
  readonly total: number;
};

export function toPage<TItem>(slice: PageSlice<TItem>, request: PageRequest): Page<TItem> {
  if (!Number.isSafeInteger(slice.total) || slice.total < 0) {
    throw new RangeError(`Total inválido para paginação: ${slice.total}`);
  }
  if (slice.items.length > request.limit) {
    throw new RangeError('A consulta devolveu mais itens que o limite da página');
  }

  return {
    data: [...slice.items],
    pagination: {
      page: request.page,
      limit: request.limit,
      total: slice.total,
      totalPages: Math.ceil(slice.total / request.limit),
    },
  };
}
