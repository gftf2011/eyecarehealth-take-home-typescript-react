/**
 * Junta classes CSS, ignorando as ausentes (`undefined`, `false`, vazias).
 * Classes de CSS Modules são `string | undefined` com `noUncheckedIndexedAccess`.
 */
export function cx(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}
