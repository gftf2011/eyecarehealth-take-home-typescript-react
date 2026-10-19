import type { OrderStatusValue } from '../../domain';
import type { OrderingMetrics } from '../ports/ordering-metrics';

/** Métricas em memória: o teste confere o que foi registrado. */
export class RecordingOrderingMetrics implements OrderingMetrics {
  placed = 0;
  readonly transitions: { from: OrderStatusValue; to: OrderStatusValue }[] = [];

  orderPlaced(): void {
    this.placed += 1;
  }

  statusChanged(from: OrderStatusValue, to: OrderStatusValue): void {
    this.transitions.push({ from, to });
  }
}
