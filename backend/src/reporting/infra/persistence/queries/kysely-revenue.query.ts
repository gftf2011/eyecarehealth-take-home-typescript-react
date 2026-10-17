import { sql, type Kysely } from 'kysely';

import type { InstantRange } from '../../../../shared-kernel/domain';
import type { DailyRevenueRow, RevenueQuery } from '../../../domain';
import type { ReportingDatabase } from '../schema/reporting-database';
import { toNumber, withinRange } from './sql-fragments';

type Row = { date: string; revenue_cents: string; orders: number };

/**
 * Receita diária pela data da **entrega**: a transição para `delivered` no
 * histórico (índice `(to_status, changed_at)`), agrupada pelo dia local no
 * fuso informado. Soma em centavos inteiros, sem ponto flutuante.
 */
export class KyselyRevenueQuery implements RevenueQuery {
  constructor(private readonly db: Kysely<ReportingDatabase>) {}

  async dailyRevenue(range: InstantRange, timeZone: string): Promise<readonly DailyRevenueRow[]> {
    const { rows } = await sql<Row>`
      SELECT
        to_char((h.changed_at AT TIME ZONE ${timeZone})::date, 'YYYY-MM-DD') AS date,
        SUM(o.total_amount * 100)::bigint AS revenue_cents,
        COUNT(*)::int AS orders
      FROM order_status_history h
      JOIN orders o ON o.id = h.order_id
      WHERE h.to_status = 'delivered'
        AND o.status = 'delivered'
        ${withinRange(sql.ref('h.changed_at'), range)}
      GROUP BY 1
      ORDER BY 1
    `.execute(this.db);

    return rows.map((row) => ({
      date: row.date,
      revenueCents: toNumber(row.revenue_cents),
      orders: row.orders,
    }));
  }
}
