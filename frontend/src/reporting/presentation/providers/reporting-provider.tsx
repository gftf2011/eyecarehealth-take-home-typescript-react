import { createContext, use, type ReactNode } from 'react';

import type { UseCase } from '../../../shared-kernel/application';
import type { ReportPeriodInput, RequestOptions } from '../../application';
import type { DeliveryTimeReport, OrdersByStatusReport, RevenueReport, TopProductsReport } from '../../domain';

type ReportUseCase<TReport> = UseCase<ReportPeriodInput & RequestOptions, TReport>;

/** Um caso de uso por relatório. */
export type ReportingServices = {
  readonly revenue: ReportUseCase<RevenueReport>;
  readonly ordersByStatus: ReportUseCase<OrdersByStatusReport>;
  readonly topProducts: ReportUseCase<TopProductsReport>;
  readonly deliveryTime: ReportUseCase<DeliveryTimeReport>;
};

const ReportingContext = createContext<ReportingServices | null>(null);

export function ReportingProvider({
  services,
  children,
}: {
  readonly services: ReportingServices;
  readonly children: ReactNode;
}) {
  return <ReportingContext value={services}>{children}</ReportingContext>;
}

export function useReportingServices(): ReportingServices {
  const services = use(ReportingContext);
  if (services === null) throw new Error('useReportingServices precisa estar dentro de <ReportingProvider>');
  return services;
}
