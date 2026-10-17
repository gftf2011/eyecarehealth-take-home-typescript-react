import { DatePeriod, LocalDate, type BoundedDatePeriod } from '../../domain';
import { RequiredFieldError } from '../errors/required-field.error';
import { validateInput } from '../validation/validate-input';

/**
 * Período opcional vindo da query string (`startDate`/`endDate` em
 * `YYYY-MM-DD`, dias locais do negócio). Ponta ausente = período aberto
 * naquele lado. Datas inválidas são reportadas juntas; depois, fim antes do
 * início.
 */
export function parseDatePeriodInput(
  startDate: string | undefined,
  endDate: string | undefined,
): DatePeriod {
  const { start, end } = validateInput({
    start: () => (startDate === undefined ? null : LocalDate.parse(startDate, 'startDate')),
    end: () => (endDate === undefined ? null : LocalDate.parse(endDate, 'endDate')),
  });
  return DatePeriod.of({ start, end });
}

/** Como `parseDatePeriodInput`, mas com as duas pontas obrigatórias. */
export function parseBoundedDatePeriodInput(
  startDate: string | undefined,
  endDate: string | undefined,
): BoundedDatePeriod {
  const { start, end } = validateInput({
    start: () => {
      if (startDate === undefined) throw new RequiredFieldError('startDate');
      return LocalDate.parse(startDate, 'startDate');
    },
    end: () => {
      if (endDate === undefined) throw new RequiredFieldError('endDate');
      return LocalDate.parse(endDate, 'endDate');
    },
  });
  return DatePeriod.between(start, end);
}
