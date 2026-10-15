import type { OrderStatusCountRow } from './queries/orders-by-status.query.js';

/**
 * Status de pedido na ótica do Reporting. Lista própria do contexto (não
 * importa o Ordering); a ordem segue o fluxo do pedido, para os gráficos.
 */
export const REPORTED_ORDER_STATUSES = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
] as const;

export type ReportedOrderStatus = (typeof REPORTED_ORDER_STATUSES)[number];

export type OrderStatusCount = {
  readonly status: ReportedOrderStatus;
  readonly count: number;
};

/** Pedidos por status: sempre traz os 6 status, com zero quando não há pedidos. */
export class OrdersByStatusReport {
  readonly data: readonly OrderStatusCount[];
  readonly total: number;

  private constructor(data: readonly OrderStatusCount[]) {
    this.data = Object.freeze([...data]);
    this.total = data.reduce((total, entry) => total + entry.count, 0);
  }

  static build(rows: readonly OrderStatusCountRow[]): OrdersByStatusReport {
    const counts = new Map<ReportedOrderStatus, number>();

    for (const row of rows) {
      if (!isReportedStatus(row.status)) {
        throw new RangeError(`Status de pedido desconhecido no relatório: ${row.status}`);
      }
      if (!Number.isSafeInteger(row.count) || row.count < 0) {
        throw new RangeError(`Contagem inválida para ${row.status}: ${row.count}`);
      }
      counts.set(row.status, (counts.get(row.status) ?? 0) + row.count);
    }

    return new OrdersByStatusReport(
      REPORTED_ORDER_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 })),
    );
  }

  countOf(status: ReportedOrderStatus): number {
    return this.data.find((entry) => entry.status === status)?.count ?? 0;
  }
}

function isReportedStatus(raw: string): raw is ReportedOrderStatus {
  return (REPORTED_ORDER_STATUSES as readonly string[]).includes(raw);
}
