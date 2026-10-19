import type { Keyset, KeysetSlice, SortKey } from '../../domain';
import { encodeCursor } from './cursor';
import type { CursorPageRequest } from './cursor-page-request';

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

type Identified = { readonly id: { readonly value: string } };

/**
 * Lê uma página por keyset e gera os cursores vizinhos. Voltar até o começo
 * pode render menos itens que o limite (itens removidos, ou o começo da
 * lista): nesse caso devolve a primeira página inteira, para "anterior"
 * nunca mostrar uma página pela metade.
 */
export async function readCursorPage<TItem extends Identified, TOutput>(
  request: CursorPageRequest<string>,
  sortKey: SortKey<TItem>,
  list: (keyset: Keyset | null) => Promise<KeysetSlice<TItem>>,
  map: (items: readonly TItem[]) => Promise<readonly TOutput[]> | readonly TOutput[],
): Promise<Page<TOutput>> {
  let { keyset } = request;
  let slice = await list(keyset);
  if (keyset?.direction === 'before' && slice.items.length < request.limit) {
    keyset = null;
    slice = await list(null);
  }
  if (slice.items.length > request.limit) {
    throw new RangeError('O repositório devolveu mais itens que o limite da página');
  }

  const hasPrevious = keyset === null ? false : keyset.direction === 'after' || slice.hasMore;
  const hasNext = keyset?.direction === 'before' || slice.hasMore;
  const first = slice.items[0];
  const last = slice.items.at(-1);
  const cursorAt = (direction: Keyset['direction'], item: TItem): string =>
    encodeCursor(request.sort, { direction, value: sortKey.of(item), id: item.id.value });

  return {
    data: await map(slice.items),
    pagination: {
      limit: request.limit,
      nextCursor: hasNext && last !== undefined ? cursorAt('after', last) : null,
      previousCursor: hasPrevious && first !== undefined ? cursorAt('before', first) : null,
    },
  };
}
