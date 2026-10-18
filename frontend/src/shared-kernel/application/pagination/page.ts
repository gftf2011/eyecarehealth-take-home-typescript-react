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

export function mapPage<TItem, TOutput>(page: Page<TItem>, map: (item: TItem) => TOutput): Page<TOutput> {
  return { data: page.data.map(map), pagination: page.pagination };
}
