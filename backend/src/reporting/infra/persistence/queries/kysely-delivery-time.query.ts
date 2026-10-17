import { sql, type Kysely } from 'kysely';

import type { InstantRange } from '../../../../shared-kernel/domain';
import type { DeliveryTimeGroupRow, DeliveryTimeQuery } from '../../../domain';
import type { ReportingDatabase } from '../schema/reporting-database';
import { toNumber, withinRange } from './sql-fragments';

type Row = {
  vehicle_type: string;
  delivered_count: number;
  average_minutes: string;
  fastest_minutes: string;
  slowest_minutes: string;
};

/**
 * Tempo de entrega (criação → transição para `delivered`) por tipo de veículo
 * do entregador. Usa o tipo de veículo **atual** do entregador: o pedido não
 * guarda o veículo do momento da entrega (limitação documentada).
 */
export class KyselyDeliveryTimeQuery implements DeliveryTimeQuery {
  constructor(private readonly db: Kysely<ReportingDatabase>) {}

  async statsByVehicleType(range: InstantRange): Promise<readonly DeliveryTimeGroupRow[]> {
    const minutes = sql`EXTRACT(EPOCH FROM (h.changed_at - o.created_at)) / 60`;
    const { rows } = await sql<Row>`
      SELECT
        d.vehicle_type,
        COUNT(*)::int AS delivered_count,
        AVG(${minutes}) AS average_minutes,
        MIN(${minutes}) AS fastest_minutes,
        MAX(${minutes}) AS slowest_minutes
      FROM order_status_history h
      JOIN orders o ON o.id = h.order_id
      JOIN delivery_persons d ON d.id = o.delivery_person_id
      WHERE h.to_status = 'delivered'
        ${withinRange(sql.ref('h.changed_at'), range)}
      GROUP BY d.vehicle_type
    `.execute(this.db);

    return rows.map((row) => ({
      vehicleType: row.vehicle_type,
      deliveredCount: row.delivered_count,
      averageMinutes: toNumber(row.average_minutes),
      fastestMinutes: toNumber(row.fastest_minutes),
      slowestMinutes: toNumber(row.slowest_minutes),
    }));
  }
}
