import {
  collectFieldErrors,
  parseBoundedDatePeriodInput,
  validateInput,
} from '../../../shared-kernel/application';
import { ReportPeriod } from '../../domain';

/** Período como vem do filtro (e da URL): `YYYY-MM-DD`, dias de São Paulo. */
export type ReportPeriodInput = {
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
};

/**
 * Início e fim obrigatórios, fim não antes do início e no máximo 366 dias —
 * as regras da API para a receita, aplicadas ao período de toda a tela.
 */
export function parseReportPeriodInput(input: ReportPeriodInput): ReportPeriod {
  const dates = parseBoundedDatePeriodInput(input.startDate, input.endDate);
  return validateInput({ period: () => ReportPeriod.between(dates.start, dates.end) }).period;
}

export function reportPeriodErrors(input: ReportPeriodInput): Partial<Record<'startDate' | 'endDate', string>> {
  return collectFieldErrors(() => parseReportPeriodInput(input));
}
