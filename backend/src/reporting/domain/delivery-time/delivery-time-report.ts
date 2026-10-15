import type { DeliveryTimeGroupRow } from './queries/delivery-time.query';

/** Tipos de veículo na ótica do Reporting (lista própria, sem importar o Delivery). */
export const REPORTED_VEHICLE_TYPES = ['bicycle', 'motorcycle', 'car'] as const;

export type ReportedVehicleType = (typeof REPORTED_VEHICLE_TYPES)[number];

export type VehicleDeliveryTime = {
  readonly vehicleType: ReportedVehicleType;
  readonly count: number;
  readonly averageMinutes: number;
  readonly fastestMinutes: number;
  readonly slowestMinutes: number;
};

/** Tolerância para comparar médias vindas do banco (ponto flutuante). */
const EPSILON = 1e-9;

/**
 * Tempo médio de entrega: de `createdAt` até a transição para `delivered`.
 *
 * - O geral é combinado a partir dos grupos: média ponderada pela quantidade,
 *   menor dos mínimos e maior dos máximos.
 * - Médias com 1 casa decimal; mínimo e máximo em minutos inteiros.
 * - Sem entregas no período, média/mínimo/máximo são `null` (não há o que medir).
 */
export class DeliveryTimeReport {
  readonly totalDelivered: number;
  readonly averageMinutes: number | null;
  readonly fastestMinutes: number | null;
  readonly slowestMinutes: number | null;
  readonly byVehicleType: readonly VehicleDeliveryTime[];

  private constructor(groups: readonly VehicleDeliveryTime[], raw: readonly DeliveryTimeGroupRow[]) {
    this.byVehicleType = Object.freeze([...groups]);
    this.totalDelivered = raw.reduce((total, group) => total + group.deliveredCount, 0);

    if (this.totalDelivered === 0) {
      this.averageMinutes = null;
      this.fastestMinutes = null;
      this.slowestMinutes = null;
      return;
    }

    const weightedSum = raw.reduce(
      (total, group) => total + group.averageMinutes * group.deliveredCount,
      0,
    );
    this.averageMinutes = roundToOneDecimal(weightedSum / this.totalDelivered);
    this.fastestMinutes = Math.round(Math.min(...raw.map((group) => group.fastestMinutes)));
    this.slowestMinutes = Math.round(Math.max(...raw.map((group) => group.slowestMinutes)));
  }

  static build(rows: readonly DeliveryTimeGroupRow[]): DeliveryTimeReport {
    const nonEmpty = rows.filter((row) => {
      assertValidGroup(row);
      return row.deliveredCount > 0;
    });

    const seen = new Set<string>();
    for (const row of nonEmpty) {
      if (seen.has(row.vehicleType)) {
        throw new RangeError(`Tipo de veículo repetido no relatório: ${row.vehicleType}`);
      }
      seen.add(row.vehicleType);
    }

    const groups = nonEmpty
      .map(
        (row): VehicleDeliveryTime => ({
          vehicleType: row.vehicleType as ReportedVehicleType,
          count: row.deliveredCount,
          averageMinutes: roundToOneDecimal(row.averageMinutes),
          fastestMinutes: Math.round(row.fastestMinutes),
          slowestMinutes: Math.round(row.slowestMinutes),
        }),
      )
      .sort((a, b) => b.count - a.count || a.vehicleType.localeCompare(b.vehicleType));

    return new DeliveryTimeReport(groups, nonEmpty);
  }
}

function assertValidGroup(row: DeliveryTimeGroupRow): void {
  if (!(REPORTED_VEHICLE_TYPES as readonly string[]).includes(row.vehicleType)) {
    throw new RangeError(`Tipo de veículo desconhecido no relatório: ${row.vehicleType}`);
  }
  if (!Number.isSafeInteger(row.deliveredCount) || row.deliveredCount < 0) {
    throw new RangeError(`Quantidade inválida para ${row.vehicleType}: ${row.deliveredCount}`);
  }
  if (row.deliveredCount === 0) return;

  const minutes = [row.fastestMinutes, row.averageMinutes, row.slowestMinutes];
  if (!minutes.every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`Minutos inválidos para ${row.vehicleType}`);
  }
  if (
    row.fastestMinutes > row.averageMinutes + EPSILON ||
    row.averageMinutes > row.slowestMinutes + EPSILON
  ) {
    throw new RangeError(`Esperado mínimo ≤ média ≤ máximo para ${row.vehicleType}`);
  }
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
