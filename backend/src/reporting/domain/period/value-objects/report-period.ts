import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidReportPeriodError } from '../errors/index.js';
import { BUSINESS_TIME_ZONE } from '../time-zone.js';
import type { LocalDate } from './local-date.js';

/** Intervalo de instantes `[from, to)`; `null` significa sem limite naquele lado. */
export type InstantRange = {
  readonly from: Date | null;
  readonly to: Date | null;
};

/** Período com início e fim obrigatórios (ex.: relatório de receita). */
export type BoundedReportPeriod = ReportPeriod & {
  readonly start: LocalDate;
  readonly end: LocalDate;
};

/**
 * Período de um relatório em dias locais, com as duas pontas inclusivas:
 * 2025-01-01 a 2025-01-31 cobre o mês inteiro de janeiro em São Paulo.
 */
export class ReportPeriod extends ValueObject<{ start: LocalDate | null; end: LocalDate | null }> {
  private constructor(start: LocalDate | null, end: LocalDate | null) {
    super({ start, end });
  }

  static between(start: LocalDate, end: LocalDate): BoundedReportPeriod {
    return ReportPeriod.of({ start, end }) as BoundedReportPeriod;
  }

  /** Pontas opcionais: sem início ou sem fim, o período fica aberto naquele lado. */
  static of(params: { start?: LocalDate | null; end?: LocalDate | null }): ReportPeriod {
    const start = params.start ?? null;
    const end = params.end ?? null;
    if (start !== null && end !== null && start.isAfter(end)) throw new InvalidReportPeriodError();
    return new ReportPeriod(start, end);
  }

  static allTime(): ReportPeriod {
    return new ReportPeriod(null, null);
  }

  get start(): LocalDate | null {
    return this.props.start;
  }

  get end(): LocalDate | null {
    return this.props.end;
  }

  isBounded(): this is BoundedReportPeriod {
    return this.props.start !== null && this.props.end !== null;
  }

  /** Converte para instantes: do início do primeiro dia ao início do dia seguinte ao último. */
  toInstantRange(timeZone: string = BUSINESS_TIME_ZONE): InstantRange {
    return {
      from: this.props.start?.startOfDayIn(timeZone) ?? null,
      to: this.props.end?.addDays(1).startOfDayIn(timeZone) ?? null,
    };
  }

  contains(date: LocalDate): boolean {
    const afterStart = this.props.start === null || !this.props.start.isAfter(date);
    const beforeEnd = this.props.end === null || !date.isAfter(this.props.end);
    return afterStart && beforeEnd;
  }

  /** Todos os dias do período, em ordem. */
  static days(period: BoundedReportPeriod): LocalDate[] {
    const days: LocalDate[] = [];
    for (let day = period.start; !day.isAfter(period.end); day = day.addDays(1)) days.push(day);
    return days;
  }
}
