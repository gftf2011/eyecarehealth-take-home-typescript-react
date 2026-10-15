export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** Ordenação por um campo de uma lista fechada (nunca vira SQL cru). */
export type Sort<TField extends string> = {
  readonly field: TField;
  readonly direction: SortDirection;
};
