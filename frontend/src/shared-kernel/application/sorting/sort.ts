import { InvalidValueError, SORT_DIRECTIONS, type SortDirection } from '../../domain';

export class InvalidSortError extends InvalidValueError {
  readonly code = 'INVALID_SORT';

  constructor(field: 'sortBy' | 'sortOrder', allowed: readonly string[]) {
    super(field, `O valor deve ser um de: ${allowed.join(', ')}`);
  }
}

/** Campo de ordenação restrito a uma lista permitida (nunca vira SQL cru). */
export function parseSortField<TField extends string>(
  raw: string | undefined,
  allowed: readonly TField[],
  defaultField: TField,
): TField {
  if (raw === undefined) return defaultField;
  const field = allowed.find((candidate) => candidate === raw);
  if (field === undefined) throw new InvalidSortError('sortBy', allowed);
  return field;
}

export function parseSortDirection(
  raw: string | undefined,
  defaultDirection: SortDirection,
): SortDirection {
  if (raw === undefined) return defaultDirection;
  const direction = SORT_DIRECTIONS.find((candidate) => candidate === raw.toLowerCase());
  if (direction === undefined) throw new InvalidSortError('sortOrder', SORT_DIRECTIONS);
  return direction;
}
