import type { UseCase } from '../../../../shared-kernel/application';
import type { TopProductsReport } from '../../../domain';
import { parseReportPeriodInput, type ReportPeriodInput } from '../../inputs/report-period.input';
import type { ReportsGateway, RequestOptions } from '../../ports/reports-gateway';

/** Tamanho do ranking pedido pelo enunciado. */
export const TOP_PRODUCTS_LIMIT = 10;

/** Os 10 produtos mais vendidos no período (só pedidos entregues), como pede o enunciado. Período inválido é recusado antes da API. */
export class GetTopProductsReportUseCase implements UseCase<ReportPeriodInput & RequestOptions, TopProductsReport> {
  constructor(private readonly reports: ReportsGateway) {}

  async execute({ signal, ...input }: ReportPeriodInput & RequestOptions): Promise<TopProductsReport> {
    const period = parseReportPeriodInput(input);
    const options = signal === undefined ? {} : { signal };
    return this.reports.topProducts(period, TOP_PRODUCTS_LIMIT, options);
  }
}
