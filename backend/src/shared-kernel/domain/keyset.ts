import type { SortDirection } from './sort';

/** Valor do campo de ordenação: texto (nome) ou inteiro (centavos, epoch em ms). */
export type SortKeyValue = string | number;

/**
 * Onde a página começa, pela posição de um item na ordenação (keyset): os
 * itens depois dele (próxima página) ou antes dele (página anterior). O ID
 * desempata itens com o mesmo valor, então nenhum se repete nem some entre
 * as páginas, mesmo com inserções no meio da navegação.
 */
export type Keyset = {
  readonly direction: 'after' | 'before';
  readonly value: SortKeyValue;
  readonly id: string;
};

/**
 * Página lida por keyset: os itens na ordem de exibição e se há mais itens
 * além deles, no sentido percorrido (depois da página com `after`, antes com
 * `before`).
 */
export type KeysetSlice<TItem> = {
  readonly items: readonly TItem[];
  readonly hasMore: boolean;
};

/** Como ler, de um item, o valor do campo de ordenação (o que vai no cursor). */
export type SortKey<TItem> = {
  readonly kind: 'text' | 'integer';
  readonly of: (item: TItem) => SortKeyValue;
};

/**
 * Sentido em que a consulta percorre o índice: o da ordenação, ou o inverso
 * para buscar a página anterior (os itens mais próximos do cursor primeiro).
 */
export function keysetScanDirection(direction: SortDirection, keyset: Keyset | null): SortDirection {
  if (keyset?.direction !== 'before') return direction;
  return direction === 'asc' ? 'desc' : 'asc';
}

/**
 * Monta a fatia a partir de até `limit + 1` itens lidos no sentido de
 * `keysetScanDirection`: o item a mais só diz que existe outra página, e a
 * página anterior volta para a ordem de exibição.
 */
export function toKeysetSlice<TItem>(scanned: readonly TItem[], limit: number, keyset: Keyset | null): KeysetSlice<TItem> {
  const items = scanned.slice(0, limit);
  if (keyset?.direction === 'before') items.reverse();
  return { items, hasMore: scanned.length > limit };
}
