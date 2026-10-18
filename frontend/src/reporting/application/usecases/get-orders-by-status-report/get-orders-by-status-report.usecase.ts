import type { UseCase } from '../../../../shared-kernel/application';
import type { OrdersByStatusReport } from '../../../domain';
import { parseReportPeriodInput, type ReportPeriodInput } from '../../inputs/report-period.input';
import type { ReportsGateway, RequestOptions } from '../../ports/reports-gateway';

/** Pedidos criados no período, agrupados pelo status atual. Período inválido é recusado antes da API. */
export class GetOrdersByStatusReportUseCase implements UseCase<ReportPeriodInput & RequestOptions, OrdersByStatusReport> {
  constructor(private readonly reports: ReportsGateway) {}

  async execute({ signal, ...input }: ReportPeriodInput & RequestOptions): Promise<OrdersByStatusReport> {
    const period = parseReportPeriodInput(input);
    const options = signal === undefined ? {} : { signal };
    return this.reports.ordersByStatus(period, options);
  }
}
