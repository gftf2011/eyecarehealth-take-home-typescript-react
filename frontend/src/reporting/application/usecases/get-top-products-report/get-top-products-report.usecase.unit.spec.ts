import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import type { DeliveryTimeReport, OrdersByStatusReport, ReportPeriod, RevenueReport, TopProductsReport } from '../../../domain';
import type { ReportsGateway } from '../../ports/reports-gateway';
import { GetTopProductsReportUseCase, TOP_PRODUCTS_LIMIT } from './get-top-products-report.usecase';

class RecordingReportsGateway implements ReportsGateway {
  readonly calls: { period: string; limit: number }[] = [];

  revenue(): Promise<RevenueReport> {
    return Promise.reject(new Error('não usado'));
  }

  ordersByStatus(): Promise<OrdersByStatusReport> {
    return Promise.reject(new Error('não usado'));
  }

  topProducts(period: ReportPeriod, limit: number): Promise<TopProductsReport> {
    this.calls.push({ period: `${period.start.toString()}..${period.end.toString()}`, limit });
    return Promise.resolve({
      products: [{ productId: 'p1', productName: 'X-Burger', totalQuantity: 42, totalRevenueCents: 138_180 }],
    });
  }

  deliveryTime(): Promise<DeliveryTimeReport> {
    return Promise.reject(new Error('não usado'));
  }
}

describe('GetTopProductsReportUseCase', () => {
  it('pede o top 10 do período', async () => {
    const gateway = new RecordingReportsGateway();

    const report = await new GetTopProductsReportUseCase(gateway).execute({
      startDate: '2026-10-01',
      endDate: '2026-10-17',
    });

    expect(TOP_PRODUCTS_LIMIT).toBe(10);
    expect(gateway.calls).toEqual([{ period: '2026-10-01..2026-10-17', limit: 10 }]);
    expect(report.products[0]?.totalQuantity).toBe(42);
  });

  it('período inválido não chega à API', async () => {
    const gateway = new RecordingReportsGateway();

    await expect(
      new GetTopProductsReportUseCase(gateway).execute({ startDate: '2026-10-17', endDate: '2026-10-01' }),
    ).rejects.toThrow(InputValidationError);
    expect(gateway.calls).toHaveLength(0);
  });
});
