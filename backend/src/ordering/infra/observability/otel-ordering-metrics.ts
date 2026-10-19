import type { OrderingMetrics } from '../../application/ports/ordering-metrics';
import type { OrderStatusValue } from '../../domain';
import { lazily, meter } from '../../../shared-kernel/infra/observability/telemetry';

const instruments = lazily(() => ({
  placed: meter().createCounter('fastmeals.orders.placed', {
    description: 'Pedidos criados (confirmados no banco)',
    unit: '{order}',
  }),
  statusChanges: meter().createCounter('fastmeals.orders.status_changes', {
    description: 'Transições de status de pedidos, por origem e destino',
    unit: '{transition}',
  }),
}));

/** Métricas de pedidos no OpenTelemetry (no-op sem o SDK carregado). */
export class OtelOrderingMetrics implements OrderingMetrics {
  orderPlaced(): void {
    instruments().placed.add(1);
  }

  statusChanged(from: OrderStatusValue, to: OrderStatusValue): void {
    instruments().statusChanges.add(1, { 'fastmeals.order.status.from': from, 'fastmeals.order.status.to': to });
  }
}
