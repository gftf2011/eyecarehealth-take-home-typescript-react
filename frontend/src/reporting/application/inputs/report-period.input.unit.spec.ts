import { describe, expect, it } from 'vitest';

import { parseReportPeriodInput, reportPeriodErrors } from './report-period.input';

describe('parseReportPeriodInput', () => {
  it('converte as duas datas no período', () => {
    const period = parseReportPeriodInput({ startDate: '2026-10-01', endDate: '2026-10-17' });

    expect(period.start.toString()).toBe('2026-10-01');
    expect(period.days).toBe(17);
  });

  it.each([
    [{ endDate: '2026-10-17' }, { startDate: 'Campo obrigatório' }],
    [{ startDate: '2026-10-17', endDate: '' }, { endDate: 'Campo obrigatório' }],
    [{ startDate: '17/10/2026', endDate: '2026-10-17' }, { startDate: "A data '17/10/2026' deve ser válida e estar no formato YYYY-MM-DD" }],
    [{ startDate: '2026-10-17', endDate: '2026-10-01' }, { endDate: 'A data fim deve ser igual ou posterior à data início' }],
    [{ startDate: '2025-01-01', endDate: '2026-06-30' }, { endDate: 'O período deve ter no máximo 366 dias' }],
  ])('%j → %j', (input, errors) => {
    expect(reportPeriodErrors(input)).toEqual(errors);
  });
});
