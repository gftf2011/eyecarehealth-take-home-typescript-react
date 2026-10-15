import { describe, expect, it } from 'vitest';

import { DeliveryTimeReport, type DeliveryTimeGroupRow } from '../index.js';

const group = (
  vehicleType: string,
  deliveredCount: number,
  averageMinutes: number,
  fastestMinutes: number,
  slowestMinutes: number,
): DeliveryTimeGroupRow => ({
  vehicleType,
  deliveredCount,
  averageMinutes,
  fastestMinutes,
  slowestMinutes,
});

describe('DeliveryTimeReport', () => {
  it('combina os grupos com média ponderada, menor mínimo e maior máximo', () => {
    const report = DeliveryTimeReport.build([
      group('bicycle', 64, 52.8, 25, 87),
      group('motorcycle', 180, 35.2, 18, 70),
      group('car', 40, 38.1, 20, 65),
    ]);

    // (52,8×64 + 35,2×180 + 38,1×40) / 284 = 39,577… → 39,6
    expect(report.averageMinutes).toBe(39.6);
    expect(report.fastestMinutes).toBe(18);
    expect(report.slowestMinutes).toBe(87);
    expect(report.totalDelivered).toBe(284);
    expect(report.byVehicleType.map((entry) => [entry.vehicleType, entry.count])).toEqual([
      ['motorcycle', 180],
      ['bicycle', 64],
      ['car', 40],
    ]);
  });

  it('arredonda médias a 1 casa e extremos ao minuto', () => {
    const report = DeliveryTimeReport.build([group('car', 3, 42.46, 17.6, 80.4)]);

    expect(report.byVehicleType[0]).toEqual({
      vehicleType: 'car',
      count: 3,
      averageMinutes: 42.5,
      fastestMinutes: 18,
      slowestMinutes: 80,
    });
  });

  it('sem entregas, devolve métricas nulas em vez de zero', () => {
    const report = DeliveryTimeReport.build([group('car', 0, 0, 0, 0)]);

    expect(report.totalDelivered).toBe(0);
    expect(report.averageMinutes).toBeNull();
    expect(report.fastestMinutes).toBeNull();
    expect(report.slowestMinutes).toBeNull();
    expect(report.byVehicleType).toEqual([]);
  });

  it.each([
    [[group('truck', 1, 10, 10, 10)], /desconhecido/],
    [[group('car', 1, 10, 10, 10), group('car', 1, 10, 10, 10)], /repetido/],
    [[group('car', 2, 5, 10, 20)], /mínimo ≤ média ≤ máximo/],
    [[group('car', 1, Number.NaN, 10, 20)], /Minutos inválidos/],
    [[group('car', -1, 10, 10, 10)], /Quantidade inválida/],
  ])('rejeita dado inconsistente do adapter %#', (rows, message) => {
    expect(() => DeliveryTimeReport.build(rows)).toThrow(message);
  });
});
