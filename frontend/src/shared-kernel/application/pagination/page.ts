export type Pagination = {
  readonly limit: number;
  /** Cursor da próxima página; `null` na última. */
  readonly nextCursor: string | null;
  /** Cursor da página anterior; `null` na primeira. */
  readonly previousCursor: string | null;
};

/** Resultado paginado, no formato `{ data, pagination }` da API. */
export type Page<TItem> = {
  readonly data: readonly TItem[];
  readonly pagination: Pagination;
};

export function mapPage<TItem, TOutput>(page: Page<TItem>, map: (item: TItem) => TOutput): Page<TOutput> {
  return { data: page.data.map(map), pagination: page.pagination };
}
