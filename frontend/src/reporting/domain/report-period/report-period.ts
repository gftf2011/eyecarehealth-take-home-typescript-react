import { DatePeriod, LocalDate, ValueObject } from '../../../shared-kernel/domain';
import { ReportPeriodTooLongError } from './errors';

/** Um ano, inclusive bissexto: a série diária da receita tem no máximo 366 pontos (regra da API). */
export const MAX_REPORT_PERIOD_DAYS = 366;

/**
 * Período dos relatórios: dias locais de São Paulo, pontas inclusivas, início
 * e fim obrigatórios e no máximo 366 dias. Um único período vale para as
 * quatro métricas da tela.
 */
export class ReportPeriod extends ValueObject<{ start: LocalDate; end: LocalDate }> {
  private constructor(start: LocalDate, end: LocalDate) {
    super({ start, end });
  }

  static between(start: LocalDate, end: LocalDate): ReportPeriod {
    DatePeriod.of({ start, end });
    if (end.isAfter(start.addDays(MAX_REPORT_PERIOD_DAYS - 1))) {
      throw new ReportPeriodTooLongError(MAX_REPORT_PERIOD_DAYS);
    }
    return new ReportPeriod(start, end);
  }

  /** Os últimos `days` dias até `today`, inclusive. */
  static lastDays(days: number, today: LocalDate): ReportPeriod {
    return ReportPeriod.between(today.addDays(1 - days), today);
  }

  /** Do dia 1 do mês de `today` até `today`. */
  static monthToDate(today: LocalDate): ReportPeriod {
    return ReportPeriod.between(today.addDays(1 - today.day), today);
  }

  get start(): LocalDate {
    return this.props.start;
  }

  get end(): LocalDate {
    return this.props.end;
  }

  get days(): number {
    let count = 1;
    for (let day = this.props.start; this.props.end.isAfter(day); day = day.addDays(1)) count += 1;
    return count;
  }
}
