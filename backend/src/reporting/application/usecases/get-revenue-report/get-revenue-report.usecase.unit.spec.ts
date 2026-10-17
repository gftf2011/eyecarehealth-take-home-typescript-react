import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FakeRevenueQuery } from '../../testing/fake-report-queries';
import { GetRevenueReportUseCase, MAX_REVENUE_PERIOD_DAYS } from './get-revenue-report.usecase';

describe('GetRevenueReportUseCase', () => {
  let query: FakeRevenueQuery;
  let getRevenue: GetRevenueReportUseCase;

  beforeEach(() => {
    query = new FakeRevenueQuery();
    getRevenue = new GetRevenueReportUseCase(query);
  });

  it('receita por período: totais, ticket médio e série diária completa, no formato da spec', async () => {
    query.rows = [
      { date: '2025-01-01', revenueCents: 52_000, orders: 12 },
      { date: '2025-01-03', revenueCents: 48_030, orders: 10 },
    ];

    const report = await getRevenue.execute({ startDate: '2025-01-01', endDate: '2025-01-03' });

    expect(report).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      totalRevenue: 1000.3,
      totalOrders: 22,
      averageOrderValue: 45.47,
      dailyRevenue: [
        { date: '2025-01-01', revenue: 520, orders: 12 },
        { date: '2025-01-02', revenue: 0, orders: 0 },
        { date: '2025-01-03', revenue: 480.3, orders: 10 },
      ],
    });
  });

  it('consulta pelos dias locais de São Paulo: do início do 1º dia ao início do dia seguinte ao último', async () => {
    await getRevenue.execute({ startDate: '2025-01-01', endDate: '2025-01-31' });

    expect(query.calls).toEqual([
      {
        range: { from: new Date('2025-01-01T03:00:00.000Z'), to: new Date('2025-02-01T03:00:00.000Z') },
        timeZone: 'America/Sao_Paulo',
      },
    ]);
  });

  it('período sem vendas: totais zerados', async () => {
    const report = await getRevenue.execute({ startDate: '2025-01-01', endDate: '2025-01-01' });

    expect(report).toMatchObject({ totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 });
    expect(report.dailyRevenue).toEqual([{ date: '2025-01-01', revenue: 0, orders: 0 }]);
  });

  it('as duas datas são obrigatórias', async () => {
    const attempt = getRevenue.execute({});

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'startDate', message: 'Campo obrigatório' },
        { field: 'endDate', message: 'Campo obrigatório' },
      ],
    });
    expect(query.calls).toHaveLength(0);
  });

  it.each([
    [{ startDate: '2025-02-30', endDate: '2025-03-01' }, 'startDate'],
    [{ startDate: '2025-01-31', endDate: '2025-01-01' }, 'endDate'],
  ])('rejeita datas inválidas ou fim antes do início (%j)', async (input, field) => {
    await expect(getRevenue.execute(input)).rejects.toMatchObject({ details: [{ field }] });
  });

  it(`aceita até ${MAX_REVENUE_PERIOD_DAYS} dias e recusa mais que isso`, async () => {
    await expect(
      getRevenue.execute({ startDate: '2024-01-01', endDate: '2024-12-31' }),
    ).resolves.toMatchObject({ dailyRevenue: expect.any(Array) });

    await expect(
      getRevenue.execute({ startDate: '2024-01-01', endDate: '2025-01-01' }),
    ).rejects.toMatchObject({
      details: [{ field: 'endDate', message: `O período deve ter no máximo ${MAX_REVENUE_PERIOD_DAYS} dias` }],
    });
  });
});
