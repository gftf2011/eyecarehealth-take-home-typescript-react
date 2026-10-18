import type {
  DeliveryTimeReport,
  OrdersByStatusReport,
  ReportPeriod,
  RevenueReport,
  TopProductsReport,
} from '../../domain';

export type RequestOptions = {
  readonly signal?: AbortSignal;
};

/** Relatórios agregados da API (`/reports/*`), todos somente leitura. */
export interface ReportsGateway {
  revenue(period: ReportPeriod, options?: RequestOptions): Promise<RevenueReport>;
  ordersByStatus(period: ReportPeriod, options?: RequestOptions): Promise<OrdersByStatusReport>;
  topProducts(period: ReportPeriod, limit: number, options?: RequestOptions): Promise<TopProductsReport>;
  deliveryTime(period: ReportPeriod, options?: RequestOptions): Promise<DeliveryTimeReport>;
}
