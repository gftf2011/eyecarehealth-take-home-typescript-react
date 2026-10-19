import { sql, type Kysely } from 'kysely';

import type { OutboxDatabase } from './outbox-events.table';

export type OutboxSnapshot = {
  readonly pending: number;
  /** Idade da mensagem pendente mais antiga: o atraso até o painel. 0 sem pendentes. */
  readonly oldestPendingAgeMs: number;
  readonly deadLettered: number;
};

/** Retrato do outbox para as métricas: uma consulta só, pelos índices parciais. */
export class OutboxStats {
  constructor(private readonly db: Kysely<OutboxDatabase>) {}

  async snapshot(): Promise<OutboxSnapshot> {
    const { rows } = await sql<{ pending: string; oldest_age_ms: string | null; dead_lettered: string }>`
      SELECT
        count(*) FILTER (WHERE published_at IS NULL AND dead_lettered_at IS NULL) AS pending,
        (extract(epoch FROM now() - min(occurred_at) FILTER (WHERE published_at IS NULL AND dead_lettered_at IS NULL)) * 1000)::bigint AS oldest_age_ms,
        count(*) FILTER (WHERE dead_lettered_at IS NOT NULL) AS dead_lettered
      FROM outbox_events
      WHERE published_at IS NULL
    `.execute(this.db);
    const row = rows[0];
    return {
      pending: Number(row?.pending ?? 0),
      oldestPendingAgeMs: Math.max(0, Number(row?.oldest_age_ms ?? 0)),
      deadLettered: Number(row?.dead_lettered ?? 0),
    };
  }
}
