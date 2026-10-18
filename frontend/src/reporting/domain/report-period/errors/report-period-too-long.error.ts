import { InvalidValueError } from '../../../../shared-kernel/domain';

/** Mesma regra da API para a receita: no máximo um ano (366 dias, inclusive bissexto). */
export class ReportPeriodTooLongError extends InvalidValueError {
  readonly code = 'REPORT_PERIOD_TOO_LONG';

  constructor(maxDays: number) {
    super('endDate', `O período deve ter no máximo ${maxDays} dias`);
  }
}
