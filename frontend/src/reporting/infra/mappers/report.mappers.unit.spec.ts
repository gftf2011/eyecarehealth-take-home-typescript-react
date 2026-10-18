import { describe, expect, it } from 'vitest';

import {
  deliveryTimeSchema,
  revenueSchema,
  topProductsSchema,
  toDeliveryTimeReport,
  toRevenueReport,
  toTopProductsReport,
} from './report.mappers';

describe('report.mappers', () => {
  it('receita: reais → centavos e datas como dias locais', () => {
    const report = toRevenueReport(
      revenueSchema.parse({
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        totalRevenue: 0.3,
        totalOrders: 2,
        averageOrderValue: 0.15,
        dailyRevenue: [
          { date: '2026-10-01', revenue: 0.1, orders: 1 },
          { date: '2026-10-02', revenue: 0.2, orders: 1 },
        ],
      }),
    );

    expect(report.totalCents).toBe(30);
    expect(report.averageOrderCents).toBe(15);
    expect(report.daily.map((day) => [day.date.toString(), day.revenueCents])).toEqual([
      ['2026-10-01', 10],
      ['2026-10-02', 20],
    ]);
  });

  it('mais vendidos: receita em centavos, ordem mantida', () => {
    const report = toTopProductsReport(
      topProductsSchema.parse({
        data: [
          { productId: 'a', productName: 'X-Burger', totalQuantity: 10, totalRevenue: 329 },
          { productId: 'b', productName: 'Suco', totalQuantity: 4, totalRevenue: 50 },
        ],
      }),
    );

    expect(report.products.map((product) => [product.productName, product.totalRevenueCents])).toEqual([
      ['X-Burger', 32900],
      ['Suco', 5000],
    ]);
  });

  it('tempo de entrega sem entregas: métricas nulas', () => {
    const report = toDeliveryTimeReport(
      deliveryTimeSchema.parse({
        averageMinutes: null,
        fastestMinutes: null,
        slowestMinutes: null,
        totalDelivered: 0,
        byVehicleType: [],
      }),
    );

    expect(report.averageMinutes).toBeNull();
    expect(report.totalDelivered).toBe(0);
  });

  it('recusa um veículo fora do contrato', () => {
    const body = {
      averageMinutes: 30,
      fastestMinutes: 20,
      slowestMinutes: 40,
      totalDelivered: 1,
      byVehicleType: [{ vehicleType: 'drone', averageMinutes: 30, fastestMinutes: 20, slowestMinutes: 40, count: 1 }],
    };
    expect(deliveryTimeSchema.safeParse(body).success).toBe(false);
  });
});
