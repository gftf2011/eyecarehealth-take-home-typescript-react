import type { ColumnType } from 'kysely';

/** `numeric`: o driver `pg` devolve como string para não perder precisão. */
export type NumericColumn = ColumnType<string, string, string>;

/** "32.90" → 3290, sem passar por ponto flutuante. */
export function decimalToCents(decimal: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(decimal);
  if (match === null) throw new RangeError(`Valor monetário inválido vindo do banco: ${decimal}`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 3290 → "32.90". */
export function centsToDecimal(cents: number): string {
  return `${Math.trunc(cents / 100)}.${(cents % 100).toString().padStart(2, '0')}`;
}

/** Coordenada `numeric` → número; falha alto se o banco devolver algo inesperado. */
export function toCoordinate(value: string): number {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) throw new RangeError(`Coordenada inválida vinda do banco: ${value}`);
  return coordinate;
}
