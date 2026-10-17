import { describe, expect, it } from 'vitest';

import { DatePeriod, InvalidDatePeriodError, LocalDate } from '..';

const date = (raw: string): LocalDate => LocalDate.parse(raw);

describe('DatePeriod', () => {
  it('rejeita fim antes do início', () => {
    expect(() => DatePeriod.between(date('2025-01-31'), date('2025-01-01'))).toThrow(
      InvalidDatePeriodError,
    );
  });

  it('aceita período de um único dia', () => {
    const period = DatePeriod.between(date('2025-01-15'), date('2025-01-15'));
    expect(DatePeriod.days(period).map(String)).toEqual(['2025-01-15']);
  });

  it('converte para [início do 1º dia, início do dia seguinte ao último) em São Paulo', () => {
    const period = DatePeriod.between(date('2025-01-01'), date('2025-01-31'));

    const range = period.toInstantRange();

    expect(range.from?.toISOString()).toBe('2025-01-01T03:00:00.000Z');
    expect(range.to?.toISOString()).toBe('2025-02-01T03:00:00.000Z');
  });

  it('deixa as pontas abertas quando não informadas', () => {
    expect(DatePeriod.allTime().toInstantRange()).toEqual({ from: null, to: null });
    expect(DatePeriod.of({ end: date('2025-01-31') }).toInstantRange().from).toBeNull();
  });

  it('identifica período fechado', () => {
    expect(DatePeriod.of({ start: date('2025-01-01'), end: date('2025-01-02') }).isBounded()).toBe(
      true,
    );
    expect(DatePeriod.of({ start: date('2025-01-01') }).isBounded()).toBe(false);
  });

  it('lista os dias do período em ordem', () => {
    const period = DatePeriod.between(date('2024-02-27'), date('2024-03-01'));
    expect(DatePeriod.days(period).map(String)).toEqual([
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it.each([
    ['2024-12-31', false],
    ['2025-01-01', true],
    ['2025-01-31', true],
    ['2025-02-01', false],
  ])('contém %s? %s', (raw, expected) => {
    const period = DatePeriod.between(date('2025-01-01'), date('2025-01-31'));
    expect(period.contains(date(raw))).toBe(expected);
  });
});
