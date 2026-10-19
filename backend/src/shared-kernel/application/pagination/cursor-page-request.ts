import type { Keyset, Sort, SortKey } from '../../domain';
import { decodeCursor } from './cursor';
import { InvalidPaginationError } from './invalid-pagination.error';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Valida o limite da página (padrão 20, máximo 100). */
export function parsePageLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_LIMIT) {
    throw new InvalidPaginationError('limit', `O limite deve ser um inteiro entre 1 e ${MAX_PAGE_LIMIT}`);
  }
  return value;
}

/** Página pedida por cursor: a ordenação, o tamanho e de onde começar. */
export class CursorPageRequest<TField extends string> {
  private constructor(
    readonly sort: Sort<TField>,
    readonly limit: number,
    /** `null` = primeira página. */
    readonly keyset: Keyset | null,
  ) {}

  /** Sem cursor (ou vazio), a primeira página. */
  static create<TField extends string>(
    sort: Sort<TField>,
    limit: number,
    cursor: string | undefined,
    sortKey: SortKey<never>,
  ): CursorPageRequest<TField> {
    const keyset = cursor === undefined || cursor === '' ? null : decodeCursor(cursor, sort, sortKey);
    return new CursorPageRequest(sort, limit, keyset);
  }
}
