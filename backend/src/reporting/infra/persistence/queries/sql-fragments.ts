import { sql, type RawBuilder } from 'kysely';

import type { InstantRange } from '../../../../shared-kernel/domain';

/**
 * Filtro `[from, to)` sobre uma coluna de instante; ponta `null` = sem limite.
 * Valores sempre como parâmetros, nunca concatenados no SQL.
 */
export function withinRange(column: RawBuilder<unknown>, range: InstantRange): RawBuilder<unknown> {
  const from = range.from === null ? sql`` : sql` AND ${column} >= ${range.from}`;
  const to = range.to === null ? sql`` : sql` AND ${column} < ${range.to}`;
  return sql`${from}${to}`;
}

/** Converte contagens/somas que o `pg` devolve como texto (bigint, numeric). */
export function toNumber(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new RangeError(`Valor numérico inválido vindo do banco: ${value}`);
  return parsed;
}
