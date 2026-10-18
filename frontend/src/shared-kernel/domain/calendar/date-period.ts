import { InvalidDatePeriodError } from '../errors/invalid-date-period.error';
import { ValueObject } from '../value-object';
import type { LocalDate } from './local-date';

/** Fuso do negócio: os dias dos filtros e relatórios são dias de São Paulo, como na API. */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Período em dias locais, com as duas pontas inclusivas. Ponta ausente deixa
 * o período aberto naquele lado (ex.: "a partir de 01/10").
 */
export class DatePeriod extends ValueObject<{ start: LocalDate | null; end: LocalDate | null }> {
  private constructor(start: LocalDate | null, end: LocalDate | null) {
    super({ start, end });
  }

  static of(params: { start?: LocalDate | null; end?: LocalDate | null }): DatePeriod {
    const start = params.start ?? null;
    const end = params.end ?? null;
    if (start !== null && end !== null && start.isAfter(end)) throw new InvalidDatePeriodError();
    return new DatePeriod(start, end);
  }

  get start(): LocalDate | null {
    return this.props.start;
  }

  get end(): LocalDate | null {
    return this.props.end;
  }
}
