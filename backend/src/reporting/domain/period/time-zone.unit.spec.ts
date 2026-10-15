import { describe, expect, it } from 'vitest';

import { BUSINESS_TIME_ZONE, startOfDayInstant } from './time-zone.js';

describe('startOfDayInstant', () => {
  it.each([
    // Sem horário de verão desde 2019: UTC−3.
    [2025, 1, 1, '2025-01-01T03:00:00.000Z'],
    [2025, 7, 15, '2025-07-15T03:00:00.000Z'],
    // Horário de verão histórico (fev/2018): UTC−2.
    [2018, 2, 1, '2018-02-01T02:00:00.000Z'],
  ])('meia-noite de %d-%d-%d em São Paulo é %s', (year, month, day, expected) => {
    expect(startOfDayInstant(year, month, day, BUSINESS_TIME_ZONE).toISOString()).toBe(expected);
  });

  it('é a própria meia-noite UTC no fuso UTC', () => {
    expect(startOfDayInstant(2025, 1, 1, 'UTC').toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('funciona para fusos à frente de UTC', () => {
    expect(startOfDayInstant(2025, 1, 1, 'Asia/Tokyo').toISOString()).toBe(
      '2024-12-31T15:00:00.000Z',
    );
  });
});
