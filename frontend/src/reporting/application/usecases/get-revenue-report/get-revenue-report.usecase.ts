import type { UseCase } from '../../../../shared-kernel/application';
import type { RevenueReport } from '../../../domain';
import { parseReportPeriodInput, type ReportPeriodInput } from '../../inputs/report-period.input';
import type { ReportsGateway, RequestOptions } from '../../ports/reports-gateway';

/** Receita por período: pedidos entregues no período, com a série diária. Período inválido é recusado antes da API. */
export class GetRevenueReportUseCase implements UseCase<ReportPeriodInput & RequestOptions, RevenueReport> {
  constructor(private readonly reports: ReportsGateway) {}

  async execute({ signal, ...input }: ReportPeriodInput & RequestOptions): Promise<RevenueReport> {
    const period = parseReportPeriodInput(input);
    const options = signal === undefined ? {} : { signal };
    return this.reports.revenue(period, options);
  }
}
