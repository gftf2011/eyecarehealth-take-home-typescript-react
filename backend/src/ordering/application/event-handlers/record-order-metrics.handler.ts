import type { DomainEventHandler, EventHandlingScope } from '../../../shared-kernel/application';
import { OrderPlaced, type OrderStatusChanged } from '../../domain';
import type { OrderingMetrics } from '../ports/ordering-metrics';

/**
 * Conta pedidos criados e transições de status **depois do commit**: um caso
 * de uso desfeito não entra na métrica.
 */
export class RecordOrderMetricsHandler implements DomainEventHandler<OrderPlaced | OrderStatusChanged> {
  constructor(private readonly metrics: OrderingMetrics) {}

  async handle(event: OrderPlaced | OrderStatusChanged, { afterCommit }: EventHandlingScope): Promise<void> {
    if (event instanceof OrderPlaced) {
      afterCommit(() => this.metrics.orderPlaced());
      return;
    }
    const { from, to } = event.payload;
    afterCommit(() => this.metrics.statusChanged(from, to));
  }
}
