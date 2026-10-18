import type { FetchHttpClient, HttpRequestOptions } from '../../../shared-kernel/infra';
import type { ReportsGateway, RequestOptions } from '../../application';
import type {
  DeliveryTimeReport,
  OrdersByStatusReport,
  ReportPeriod,
  RevenueReport,
  TopProductsReport,
} from '../../domain';
import {
  deliveryTimeSchema,
  ordersByStatusSchema,
  revenueSchema,
  topProductsSchema,
  toDeliveryTimeReport,
  toOrdersByStatusReport,
  toRevenueReport,
  toTopProductsReport,
} from '../mappers/report.mappers';

/** `/api/reports/*` com o cliente autenticado. */
export class HttpReportsGateway implements ReportsGateway {
  constructor(private readonly http: FetchHttpClient) {}

  async revenue(period: ReportPeriod, options: RequestOptions = {}): Promise<RevenueReport> {
    return toRevenueReport(await this.http.request(request('/reports/revenue', period, options), revenueSchema));
  }

  async ordersByStatus(period: ReportPeriod, options: RequestOptions = {}): Promise<OrdersByStatusReport> {
    return toOrdersByStatusReport(
      await this.http.request(request('/reports/orders-by-status', period, options), ordersByStatusSchema),
    );
  }

  async topProducts(period: ReportPeriod, limit: number, options: RequestOptions = {}): Promise<TopProductsReport> {
    return toTopProductsReport(
      await this.http.request(request('/reports/top-products', period, options, { limit }), topProductsSchema),
    );
  }

  async deliveryTime(period: ReportPeriod, options: RequestOptions = {}): Promise<DeliveryTimeReport> {
    return toDeliveryTimeReport(
      await this.http.request(request('/reports/average-delivery-time', period, options), deliveryTimeSchema),
    );
  }
}

function request(
  path: string,
  period: ReportPeriod,
  options: RequestOptions,
  extra: Readonly<Record<string, number>> = {},
): HttpRequestOptions {
  return {
    path,
    query: { startDate: period.start.toString(), endDate: period.end.toString(), ...extra },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}
