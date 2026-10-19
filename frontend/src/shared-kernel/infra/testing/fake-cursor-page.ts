/**
 * Página por cursor para as APIs simuladas: o cursor do fake é só o índice do
 * primeiro item (`i40`). O painel trata o cursor como opaco, então qualquer
 * formato serve, desde que a navegação se comporte como a da API.
 */
export function fakeCursorPage<TItem>(
  items: readonly TItem[],
  query: URLSearchParams,
): { data: TItem[]; pagination: { limit: number; nextCursor: string | null; previousCursor: string | null } } {
  const limit = Number(query.get('limit') ?? '20');
  const start = Number(/^i(\d+)$/.exec(query.get('cursor') ?? '')?.[1] ?? '0');
  const end = start + limit;
  return {
    data: items.slice(start, end),
    pagination: {
      limit,
      nextCursor: end < items.length ? `i${end}` : null,
      previousCursor: start > 0 ? `i${Math.max(start - limit, 0)}` : null,
    },
  };
}
