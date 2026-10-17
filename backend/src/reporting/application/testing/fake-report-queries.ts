import type { InstantRange } from '../../../shared-kernel/domain';
import type {
  DailyRevenueRow,
  DeliveryTimeGroupRow,
  DeliveryTimeQuery,
  OrdersByStatusQuery,
  OrderStatusCountRow,
  ProductSalesRow,
  RevenueQuery,
  TopProductsQuery,
} from '../../domain';

/**
 * Ports de leitura falsos: devolvem as linhas configuradas (como se o banco
 * já tivesse agregado) e registram os argumentos de cada chamada, para os
 * testes conferirem o período e o fuso enviados.
 */
export class FakeRevenueQuery implements RevenueQuery {
  rows: DailyRevenueRow[] = [];
  readonly calls: { range: InstantRange; timeZone: string }[] = [];

  async dailyRevenue(range: InstantRange, timeZone: string): Promise<readonly DailyRevenueRow[]> {
    this.calls.push({ range, timeZone });
    return this.rows;
  }
}

export class FakeOrdersByStatusQuery implements OrdersByStatusQuery {
  rows: OrderStatusCountRow[] = [];
  readonly calls: InstantRange[] = [];

  async countByStatus(range: InstantRange): Promise<readonly OrderStatusCountRow[]> {
    this.calls.push(range);
    return this.rows;
  }
}

export class FakeTopProductsQuery implements TopProductsQuery {
  rows: ProductSalesRow[] = [];
  readonly calls: { range: InstantRange; limit: number }[] = [];

  async salesByProduct(range: InstantRange, limit: number): Promise<readonly ProductSalesRow[]> {
    this.calls.push({ range, limit });
    return this.rows;
  }
}

export class FakeDeliveryTimeQuery implements DeliveryTimeQuery {
  rows: DeliveryTimeGroupRow[] = [];
  readonly calls: InstantRange[] = [];

  async statsByVehicleType(range: InstantRange): Promise<readonly DeliveryTimeGroupRow[]> {
    this.calls.push(range);
    return this.rows;
  }
}
