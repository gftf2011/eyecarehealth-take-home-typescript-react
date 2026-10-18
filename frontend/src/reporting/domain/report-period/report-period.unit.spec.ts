import { describe, expect, it } from 'vitest';

import { InvalidDatePeriodError, LocalDate } from '../../../shared-kernel/domain';
import { ReportPeriod, ReportPeriodTooLongError } from '..';

const day = (iso: string): LocalDate => LocalDate.parse(iso);

describe('ReportPeriod', () => {
  it('aceita um período de um dia (pontas inclusivas)', () => {
    expect(ReportPeriod.between(day('2026-10-17'), day('2026-10-17')).days).toBe(1);
  });

  it('aceita até 366 dias e recusa 367', () => {
    expect(ReportPeriod.between(day('2024-01-01'), day('2024-12-31')).days).toBe(366);
    expect(() => ReportPeriod.between(day('2025-01-01'), day('2026-01-02'))).toThrow(ReportPeriodTooLongError);
  });

  it('recusa fim antes do início', () => {
    expect(() => ReportPeriod.between(day('2026-10-17'), day('2026-10-01'))).toThrow(InvalidDatePeriodError);
  });

  it.each([
    [7, '2026-10-11'],
    [30, '2026-09-18'],
  ])('últimos %i dias até hoje começam em %s', (days, start) => {
    const period = ReportPeriod.lastDays(days, day('2026-10-17'));

    expect(period.start.toString()).toBe(start);
    expect(period.end.toString()).toBe('2026-10-17');
    expect(period.days).toBe(days);
  });

  it('mês até hoje começa no dia 1', () => {
    expect(ReportPeriod.monthToDate(day('2026-10-17')).start.toString()).toBe('2026-10-01');
  });
});
