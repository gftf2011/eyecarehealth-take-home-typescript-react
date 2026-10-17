import { sql, type Kysely } from 'kysely';

import type { InstantRange } from '../../../../shared-kernel/domain';
import type { OrdersByStatusQuery, OrderStatusCountRow } from '../../../domain';
import type { ReportingDatabase } from '../schema/reporting-database';
import { withinRange } from './sql-fragments';

type Row = { status: string; count: number };

/** Contagem por status atual, filtrando pela criação (índice `(status, created_at)`). */
export class KyselyOrdersByStatusQuery implements OrdersByStatusQuery {
  constructor(private readonly db: Kysely<ReportingDatabase>) {}

  async countByStatus(range: InstantRange): Promise<readonly OrderStatusCountRow[]> {
    const { rows } = await sql<Row>`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE true ${withinRange(sql.ref('created_at'), range)}
      GROUP BY status
    `.execute(this.db);

    return rows;
  }
}
