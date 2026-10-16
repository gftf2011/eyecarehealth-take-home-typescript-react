import type { InstantRange } from '../../../../shared-kernel/domain';

/** Estatística de entregas de um tipo de veículo, agregada pelo banco. */
export type DeliveryTimeGroupRow = {
  readonly vehicleType: string;
  readonly deliveredCount: number;
  /** Médias/extremos de (instante da transição para `delivered` − `created_at`). */
  readonly averageMinutes: number;
  readonly fastestMinutes: number;
  readonly slowestMinutes: number;
};

/**
 * Port de leitura: tempo de entrega dos pedidos `delivered` entregues em
 * `range`, agrupado pelo tipo de veículo do entregador atribuído.
 */
export interface DeliveryTimeQuery {
  statsByVehicleType(range: InstantRange): Promise<readonly DeliveryTimeGroupRow[]>;
}
