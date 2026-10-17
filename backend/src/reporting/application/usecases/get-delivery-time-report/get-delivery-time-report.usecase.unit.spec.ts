import { beforeEach, describe, expect, it } from 'vitest';

import { FakeDeliveryTimeQuery } from '../../testing/fake-report-queries';
import { GetDeliveryTimeReportUseCase } from './get-delivery-time-report.usecase';

describe('GetDeliveryTimeReportUseCase', () => {
  let query: FakeDeliveryTimeQuery;
  let getDeliveryTime: GetDeliveryTimeReportUseCase;

  beforeEach(() => {
    query = new FakeDeliveryTimeQuery();
    getDeliveryTime = new GetDeliveryTimeReportUseCase(query);
  });

  it('combina os grupos por veículo: média ponderada, menor mínimo e maior máximo', async () => {
    query.rows = [
      { vehicleType: 'motorcycle', deliveredCount: 3, averageMinutes: 30, fastestMinutes: 18, slowestMinutes: 45 },
      { vehicleType: 'bicycle', deliveredCount: 1, averageMinutes: 50, fastestMinutes: 50, slowestMinutes: 50 },
    ];

    expect(await getDeliveryTime.execute({})).toEqual({
      // (3 × 30 + 1 × 50) / 4 = 35
      averageMinutes: 35,
      fastestMinutes: 18,
      slowestMinutes: 50,
      totalDelivered: 4,
      byVehicleType: [
        { vehicleType: 'motorcycle', averageMinutes: 30, fastestMinutes: 18, slowestMinutes: 45, count: 3 },
        { vehicleType: 'bicycle', averageMinutes: 50, fastestMinutes: 50, slowestMinutes: 50, count: 1 },
      ],
    });
  });

  it('sem entregas no período: médias e extremos nulos', async () => {
    expect(await getDeliveryTime.execute({ startDate: '2025-01-01', endDate: '2025-01-31' })).toEqual({
      averageMinutes: null,
      fastestMinutes: null,
      slowestMinutes: null,
      totalDelivered: 0,
      byVehicleType: [],
    });
    expect(query.calls).toEqual([
      { from: new Date('2025-01-01T03:00:00.000Z'), to: new Date('2025-02-01T03:00:00.000Z') },
    ]);
  });
});
