import type { FetchHttpClient } from '../../shared-kernel/infra';
import {
  GetDeliveryTimeReportUseCase,
  GetOrdersByStatusReportUseCase,
  GetRevenueReportUseCase,
  GetTopProductsReportUseCase,
} from '../application';
import { HttpReportsGateway } from '../infra';
import type { ReportingServices } from '../presentation';

export type ReportingModule = {
  readonly services: ReportingServices;
};

/** Composition root do Reporting (somente leitura). */
export function createReportingModule(api: FetchHttpClient): ReportingModule {
  const reports = new HttpReportsGateway(api);
  return {
    services: {
      revenue: new GetRevenueReportUseCase(reports),
      ordersByStatus: new GetOrdersByStatusReportUseCase(reports),
      topProducts: new GetTopProductsReportUseCase(reports),
      deliveryTime: new GetDeliveryTimeReportUseCase(reports),
    },
  };
}
