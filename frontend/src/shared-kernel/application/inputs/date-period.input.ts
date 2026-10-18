import { DatePeriod, LocalDate } from '../../domain';
import { RequiredFieldError } from '../errors/required-field.error';
import { validateInput } from '../validation/validate-input';

const blankToUndefined = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

/**
 * Período opcional de um filtro (`startDate`/`endDate` em `YYYY-MM-DD`, dias
 * de São Paulo), com as regras da API: datas inválidas juntas; depois, fim
 * antes do início. Campo vazio = período aberto naquele lado.
 */
export function parseDatePeriodInput(startDate: string | undefined, endDate: string | undefined): DatePeriod {
  const start = blankToUndefined(startDate);
  const end = blankToUndefined(endDate);
  const dates = validateInput({
    start: () => (start === undefined ? null : LocalDate.parse(start, 'startDate')),
    end: () => (end === undefined ? null : LocalDate.parse(end, 'endDate')),
  });
  return validateInput({ period: () => DatePeriod.of(dates) }).period;
}

/** Como `parseDatePeriodInput`, mas com as duas pontas obrigatórias (ex.: receita). */
export function parseBoundedDatePeriodInput(
  startDate: string | undefined,
  endDate: string | undefined,
): DatePeriod & { readonly start: LocalDate; readonly end: LocalDate } {
  const start = blankToUndefined(startDate);
  const end = blankToUndefined(endDate);
  const dates = validateInput({
    start: () => {
      if (start === undefined) throw new RequiredFieldError('startDate');
      return LocalDate.parse(start, 'startDate');
    },
    end: () => {
      if (end === undefined) throw new RequiredFieldError('endDate');
      return LocalDate.parse(end, 'endDate');
    },
  });
  const { period } = validateInput({ period: () => DatePeriod.of(dates) });
  return period as DatePeriod & { readonly start: LocalDate; readonly end: LocalDate };
}
