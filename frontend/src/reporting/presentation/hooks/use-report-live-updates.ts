import type { QueryKey } from '@tanstack/react-query';

import type { LiveEvent } from '../../../shared-kernel/application';
import { useLiveInvalidation } from '../../../shared-kernel/presentation';
import { REPORTS_QUERY_KEY, type ReportKind } from './use-report';

/** Tópicos públicos que mudam os números (contratos do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';
const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';

/**
 * Relatórios são as consultas mais caras do painel: recarregam no máximo a
 * cada 5 s, e só os que o evento muda.
 */
const REPORTS_REFRESH_INTERVAL_MS = 5_000;

/**
 * - Pedidos por status contam pela data de criação e status atual: qualquer
 *   pedido novo ou mudança de status muda a contagem.
 * - Receita, mais vendidos e tempo de entrega só consideram pedidos
 *   entregues: mudam quando um pedido vira `delivered`.
 * - Mais vendidos mostram o nome atual do produto: mudam se ele for editado.
 * Preço (os pedidos guardam o preço da época), disponibilidade e troca de
 * entregador não mexem em nenhum relatório.
 */
export function reportAffectedBy(event: LiveEvent, queryKey: QueryKey): boolean {
  const kind = queryKey[1] as ReportKind | undefined;
  const type = event.payload['type'];

  if (event.topic === PRODUCT_UPDATES_TOPIC) return type === 'product.updated' && kind === 'topProducts';
  switch (type) {
    case 'order.placed':
      return kind === 'ordersByStatus';
    case 'order.status-changed':
      return kind === 'ordersByStatus' || event.payload['status'] === 'delivered';
    case 'order.delivery-person-assigned':
      return false;
    default:
      return true;
  }
}

/** Relatórios em tempo real, sem que cada evento dispare as quatro agregações. */
export function useReportLiveUpdates(): void {
  useLiveInvalidation(
    [
      { topic: ORDER_UPDATES_TOPIC, queryKey: REPORTS_QUERY_KEY, affects: reportAffectedBy },
      { topic: PRODUCT_UPDATES_TOPIC, queryKey: REPORTS_QUERY_KEY, affects: reportAffectedBy },
    ],
    { intervalMs: REPORTS_REFRESH_INTERVAL_MS },
  );
}
