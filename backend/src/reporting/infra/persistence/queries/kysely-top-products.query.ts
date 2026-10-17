import { sql, type Kysely } from 'kysely';

import type { InstantRange } from '../../../../shared-kernel/domain';
import type { ProductSalesRow, TopProductsQuery } from '../../../domain';
import type { ReportingDatabase } from '../schema/reporting-database';
import { toNumber, withinRange } from './sql-fragments';

type Row = {
  product_id: string;
  product_name: string;
  total_quantity: string;
  total_revenue_cents: string;
};

/**
 * Vendas por produto nos pedidos entregues no período. Receita pelo preço
 * congelado no pedido (`unit_price`); nome atual do Catalog, para o mesmo
 * produto não aparecer com nomes diferentes depois de renomeado.
 *
 * Ordena e limita no banco (o domínio reaplica o desempate; uma divergência
 * de collation só importaria num empate exato bem no corte do `LIMIT`).
 */
export class KyselyTopProductsQuery implements TopProductsQuery {
  constructor(private readonly db: Kysely<ReportingDatabase>) {}

  async salesByProduct(range: InstantRange, limit: number): Promise<readonly ProductSalesRow[]> {
    const { rows } = await sql<Row>`
      SELECT
        i.product_id,
        p.name AS product_name,
        SUM(i.quantity)::bigint AS total_quantity,
        SUM(i.unit_price * i.quantity * 100)::bigint AS total_revenue_cents
      FROM order_status_history h
      JOIN order_items i ON i.order_id = h.order_id
      JOIN products p ON p.id = i.product_id
      WHERE h.to_status = 'delivered'
        ${withinRange(sql.ref('h.changed_at'), range)}
      GROUP BY i.product_id, p.name
      ORDER BY total_quantity DESC, total_revenue_cents DESC, p.name, i.product_id
      LIMIT ${limit}
    `.execute(this.db);

    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      totalQuantity: toNumber(row.total_quantity),
      totalRevenueCents: toNumber(row.total_revenue_cents),
    }));
  }
}
