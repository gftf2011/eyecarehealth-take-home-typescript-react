import {
  parseBoundedDatePeriodInput,
  validateInput,
  type UseCase,
} from '../../../../shared-kernel/application';
import { BUSINESS_TIME_ZONE, type BoundedDatePeriod } from '../../../../shared-kernel/domain';
import { RevenueReport, type RevenueQuery } from '../../../domain';
import { toRevenueReportDto, type RevenueReportDto } from '../../dtos/report.dtos';
import { ReportPeriodTooLongError } from '../../errors/report-period-too-long.error';

/** Um ano, inclusive bissexto: a série diária tem no máximo 366 pontos. */
export const MAX_REVENUE_PERIOD_DAYS = 366;

export type GetRevenueReportInput = {
  /** Obrigatório, `YYYY-MM-DD`. */
  readonly startDate?: string | undefined;
  /** Obrigatório, `YYYY-MM-DD`, inclusive. */
  readonly endDate?: string | undefined;
};

/**
 * Receita por período: soma do `totalAmount` dos pedidos `delivered` cuja
 * entrega ocorreu no período (dias locais do negócio), com a série diária.
 */
export class GetRevenueReportUseCase implements UseCase<GetRevenueReportInput, RevenueReportDto> {
  constructor(private readonly revenue: RevenueQuery) {}

  async execute(input: GetRevenueReportInput): Promise<RevenueReportDto> {
    const { period } = validateInput({
      period: () => limitLength(parseBoundedDatePeriodInput(input.startDate, input.endDate)),
    });

    const rows = await this.revenue.dailyRevenue(period.toInstantRange(), BUSINESS_TIME_ZONE);
    return toRevenueReportDto(RevenueReport.build(period, rows));
  }
}

function limitLength(period: BoundedDatePeriod): BoundedDatePeriod {
  const lastAllowedDay = period.start.addDays(MAX_REVENUE_PERIOD_DAYS - 1);
  if (period.end.isAfter(lastAllowedDay)) throw new ReportPeriodTooLongError(MAX_REVENUE_PERIOD_DAYS);
  return period;
}
