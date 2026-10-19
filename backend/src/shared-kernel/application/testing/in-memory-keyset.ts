import {
  keysetScanDirection,
  toKeysetSlice,
  type Keyset,
  type KeysetSlice,
  type Sort,
  type SortKey,
  type SortKeyValue,
} from '../../domain';

type Identified = { readonly id: { readonly value: string } };

/**
 * A mesma leitura por keyset do SQL, para os repositórios em memória: ordena
 * por (campo, ID) no sentido da ordenação, fica com o que está depois (ou
 * antes) do cursor e devolve até `limit` itens.
 */
export function keysetSliceInMemory<TItem extends Identified>(
  items: readonly TItem[],
  criteria: { readonly sort: Sort<string>; readonly keyset: Keyset | null; readonly limit: number },
  sortKey: SortKey<TItem>,
): KeysetSlice<TItem> {
  const scan = keysetScanDirection(criteria.sort.direction, criteria.keyset);
  const sign = scan === 'asc' ? 1 : -1;
  const position = (item: TItem): readonly [SortKeyValue, string] => [sortKey.of(item), item.id.value];
  const compare = (a: readonly [SortKeyValue, string], b: readonly [SortKeyValue, string]): number =>
    sign * (compareValues(a[0], b[0]) || compareIds(a[1], b[1]));

  const { keyset } = criteria;
  const scanned = [...items]
    .sort((a, b) => compare(position(a), position(b)))
    .filter((item) => keyset === null || compare(position(item), [keyset.value, keyset.id]) > 0)
    .slice(0, criteria.limit + 1);
  return toKeysetSlice(scanned, criteria.limit, keyset);
}

function compareValues(a: SortKeyValue, b: SortKeyValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR');
}

/** A mesma ordem do `uuid` do PostgreSQL (bytes, em hexadecimal minúsculo). */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
