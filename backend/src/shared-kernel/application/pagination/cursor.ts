import type { Keyset, Sort, SortKey } from '../../domain';
import { InvalidPaginationError } from './invalid-pagination.error';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Maior que qualquer campo de texto ordenável (o nome do produto tem até 120). */
const MAX_TEXT_VALUE_LENGTH = 200;
const INVALID_CURSOR = 'Cursor inválido: use o `nextCursor` ou o `previousCursor` de uma resposta com a mesma ordenação';

/** O que o cursor guarda: a ordenação em que foi gerado e a posição do item. */
type CursorPayload = {
  readonly f: string;
  readonly o: string;
  readonly d: 'a' | 'b';
  readonly v: string | number;
  readonly id: string;
};

/**
 * Cursor opaco (base64url de um JSON curto). Não é segredo nem assinatura: só
 * a posição de um item, que o cliente devolve como recebeu. Fica preso à
 * ordenação em que foi gerado, porque a posição só vale nela.
 */
export function encodeCursor(sort: Sort<string>, keyset: Keyset): string {
  const payload: CursorPayload = {
    f: sort.field,
    o: sort.direction,
    d: keyset.direction === 'after' ? 'a' : 'b',
    v: keyset.value,
    id: keyset.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Lê o cursor; formato, ordenação ou valor que não confere → `INVALID_PAGINATION`. */
export function decodeCursor(cursor: string, sort: Sort<string>, sortKey: SortKey<never>): Keyset {
  const payload = parse(cursor);
  if (
    payload === null ||
    payload.f !== sort.field ||
    payload.o !== sort.direction ||
    (payload.d !== 'a' && payload.d !== 'b') ||
    typeof payload.id !== 'string' ||
    !UUID_PATTERN.test(payload.id) ||
    !isValidValue(payload.v, sortKey.kind)
  ) {
    throw new InvalidPaginationError('cursor', INVALID_CURSOR);
  }
  return { direction: payload.d === 'a' ? 'after' : 'before', value: payload.v, id: payload.id };
}

function parse(cursor: string): Partial<Record<keyof CursorPayload, unknown>> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function isValidValue(value: unknown, kind: SortKey<never>['kind']): value is string | number {
  return kind === 'integer'
    ? Number.isSafeInteger(value)
    : typeof value === 'string' && value.length <= MAX_TEXT_VALUE_LENGTH;
}
