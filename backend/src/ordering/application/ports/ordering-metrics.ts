import type { OrderStatusValue } from '../../domain';

/**
 * Port de saída: métricas de negócio dos pedidos. A aplicação diz o que
 * aconteceu; o adapter (OpenTelemetry) decide como medir.
 */
export interface OrderingMetrics {
  orderPlaced(): void;
  statusChanged(from: OrderStatusValue, to: OrderStatusValue): void;
}
