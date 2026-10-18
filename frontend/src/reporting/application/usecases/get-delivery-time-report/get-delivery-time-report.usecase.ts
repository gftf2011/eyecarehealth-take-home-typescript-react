import type { UseCase } from '../../../../shared-kernel/application';
import type { DeliveryTimeReport } from '../../../domain';
import { parseReportPeriodInput, type ReportPeriodInput } from '../../inputs/report-period.input';
import type { ReportsGateway, RequestOptions } from '../../ports/reports-gateway';

/** Tempo médio entre a criação e a entrega, geral e por tipo de veículo. Período inválido é recusado antes da API. */
export class GetDeliveryTimeReportUseCase implements UseCase<ReportPeriodInput & RequestOptions, DeliveryTimeReport> {
  constructor(private readonly reports: ReportsGateway) {}

  async execute({ signal, ...input }: ReportPeriodInput & RequestOptions): Promise<DeliveryTimeReport> {
    const period = parseReportPeriodInput(input);
    const options = signal === undefined ? {} : { signal };
    return this.reports.deliveryTime(period, options);
  }
}
