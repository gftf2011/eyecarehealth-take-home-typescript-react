import { InvalidValueError } from '../../../shared-kernel/domain';

/**
 * Período longo demais para um relatório com série diária: a resposta teria
 * um ponto por dia. Limita o tamanho da resposta e o custo da consulta.
 */
export class ReportPeriodTooLongError extends InvalidValueError {
  readonly code = 'REPORT_PERIOD_TOO_LONG';

  constructor(maxDays: number) {
    super('endDate', `O período deve ter no máximo ${maxDays} dias`);
  }
}
