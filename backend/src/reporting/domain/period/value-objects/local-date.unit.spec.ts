import { describe, expect, it } from 'vitest';

import { InvalidLocalDateError, LocalDate } from '../../index.js';

describe('LocalDate', () => {
  it.each(['2025-01-31', '2024-02-29', '1900-01-01'])('aceita %s', (raw) => {
    expect(LocalDate.parse(raw).toString()).toBe(raw);
  });

  it.each(['2025-02-29', '2025-13-01', '2025-04-31', '2025-1-1', '25-01-01', '0025-01-01', '2025-01-01T00:00:00Z', ''])(
    'rejeita %j',
    (raw) => {
      expect(() => LocalDate.parse(raw, 'startDate')).toThrow(InvalidLocalDateError);
      expect(() => LocalDate.parse(raw, 'startDate')).toThrow(
        expect.objectContaining({ field: 'startDate' }),
      );
    },
  );

  it('soma dias atravessando mês e ano bissexto', () => {
    expect(LocalDate.parse('2024-02-28').addDays(1).toString()).toBe('2024-02-29');
    expect(LocalDate.parse('2024-12-31').addDays(1).toString()).toBe('2025-01-01');
    expect(LocalDate.parse('2025-03-01').addDays(-1).toString()).toBe('2025-02-28');
  });

  it('compara datas', () => {
    const first = LocalDate.parse('2025-01-01');
    const second = LocalDate.parse('2025-01-02');
    expect(second.isAfter(first)).toBe(true);
    expect(first.compareTo(LocalDate.parse('2025-01-01'))).toBe(0);
  });

  it('serializa como YYYY-MM-DD', () => {
    expect(JSON.stringify({ date: LocalDate.parse('2025-01-05') })).toBe('{"date":"2025-01-05"}');
  });
});
