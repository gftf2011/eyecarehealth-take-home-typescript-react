import { describe, expect, it } from 'vitest';

import { DatePeriod, LocalDate } from '../../../shared-kernel/domain';
import { RevenueReport } from '..';

const january = DatePeriod.between(LocalDate.parse('2025-01-01'), LocalDate.parse('2025-01-05'));

describe('RevenueReport', () => {
  it('soma receita e pedidos e calcula o ticket médio', () => {
    const report = RevenueReport.build(january, [
      { date: '2025-01-01', revenueCents: 52_000, orders: 12 },
      { date: '2025-01-03', revenueCents: 48_030, orders: 10 },
    ]);

    expect(report.totalRevenue.toDecimal()).toBe(1000.3);
    expect(report.totalOrders).toBe(22);
    // 100 030 / 22 = 4 546,8181… → 4 547 centavos
    expect(report.averageOrderValue.toDecimal()).toBe(45.47);
  });

  it('preenche com zero os dias sem venda, em ordem', () => {
    const report = RevenueReport.build(january, [
      { date: '2025-01-03', revenueCents: 1_000, orders: 1 },
    ]);

    expect(
      report.dailyRevenue.map((day) => [String(day.date), day.revenue.cents, day.orders]),
    ).toEqual([
      ['2025-01-01', 0, 0],
      ['2025-01-02', 0, 0],
      ['2025-01-03', 1_000, 1],
      ['2025-01-04', 0, 0],
      ['2025-01-05', 0, 0],
    ]);
  });

  it('sem pedidos entregues, tudo zera (inclusive o ticket médio)', () => {
    const report = RevenueReport.build(january, []);

    expect(report.totalRevenue.isZero()).toBe(true);
    expect(report.totalOrders).toBe(0);
    expect(report.averageOrderValue.isZero()).toBe(true);
    expect(report.dailyRevenue).toHaveLength(5);
  });

  it('acumula linhas repetidas do mesmo dia', () => {
    const report = RevenueReport.build(january, [
      { date: '2025-01-02', revenueCents: 100, orders: 1 },
      { date: '2025-01-02', revenueCents: 250, orders: 2 },
    ]);

    expect(report.dailyRevenue[1]?.revenue.cents).toBe(350);
    expect(report.dailyRevenue[1]?.orders).toBe(3);
  });

  it.each([
    [{ date: '2025-01-06', revenueCents: 1, orders: 1 }, /fora do período/],
    [{ date: '2025-01-02', revenueCents: -1, orders: 1 }, /revenueCents/],
    [{ date: '2025-01-02', revenueCents: 1, orders: 1.5 }, /orders/],
  ])('rejeita dado inconsistente do adapter %#', (row, message) => {
    expect(() => RevenueReport.build(january, [row])).toThrow(message);
  });
});
