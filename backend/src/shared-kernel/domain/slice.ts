/** Fatia de uma consulta paginada: os itens da página e o total geral. */
export type Slice<TItem> = {
  readonly items: readonly TItem[];
  readonly total: number;
};
