import { DatePeriod, LocalDate, Money, type BoundedDatePeriod } from '../../../shared-kernel/domain';
import type { DailyRevenueRow } from './queries/revenue.query';

export type DailyRevenue = {
  readonly date: LocalDate;
  readonly revenue: Money;
  readonly orders: number;
};

/**
 * Receita por período (somente pedidos `delivered`, pela data de entrega).
 *
 * Regras:
 * - A série diária cobre todos os dias do período; dias sem venda valem zero.
 * - Ticket médio = receita / pedidos, arredondado ao centavo; zero sem pedidos.
 */
export class RevenueReport {
  readonly period: BoundedDatePeriod;
  readonly dailyRevenue: readonly DailyRevenue[];
  readonly totalRevenue: Money;
  readonly totalOrders: number;

  private constructor(period: BoundedDatePeriod, dailyRevenue: readonly DailyRevenue[]) {
    this.period = period;
    this.dailyRevenue = Object.freeze([...dailyRevenue]);
    this.totalRevenue = dailyRevenue.reduce((total, day) => total.add(day.revenue), Money.zero());
    this.totalOrders = dailyRevenue.reduce((total, day) => total + day.orders, 0);
  }

  static build(period: BoundedDatePeriod, rows: readonly DailyRevenueRow[]): RevenueReport {
    const byDate = new Map<string, { revenueCents: number; orders: number }>();

    for (const row of rows) {
      const date = LocalDate.parse(row.date);
      if (!period.contains(date)) {
        throw new RangeError(`Linha de receita fora do período: ${row.date}`);
      }
      assertNonNegativeInteger(row.revenueCents, 'revenueCents');
      assertNonNegativeInteger(row.orders, 'orders');

      const accumulated = byDate.get(date.toString()) ?? { revenueCents: 0, orders: 0 };
      byDate.set(date.toString(), {
        revenueCents: accumulated.revenueCents + row.revenueCents,
        orders: accumulated.orders + row.orders,
      });
    }

    const daily = DatePeriod.days(period).map((date) => {
      const totals = byDate.get(date.toString()) ?? { revenueCents: 0, orders: 0 };
      return { date, revenue: Money.fromCents(totals.revenueCents), orders: totals.orders };
    });
    return new RevenueReport(period, daily);
  }

  get averageOrderValue(): Money {
    if (this.totalOrders === 0) return Money.zero();
    return Money.fromCents(Math.round(this.totalRevenue.cents / this.totalOrders));
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} deve ser um inteiro não negativo (recebido ${value})`);
  }
}
