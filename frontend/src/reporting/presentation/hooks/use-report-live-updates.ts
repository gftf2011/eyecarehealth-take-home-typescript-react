import { useQueryClient } from '@tanstack/react-query';

import { useLiveEvents } from '../../../shared-kernel/presentation';
import { REPORTS_QUERY_KEY } from './use-report';

/** Tópicos públicos que mudam os números (contratos do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';
const PRODUCT_UPDATES_TOPIC = 'catalog.product-updates';

/**
 * Relatórios em tempo real: pedidos novos ou que mudam de status alteram
 * faturamento, contagens e tempo de entrega; produtos renomeados mudam o
 * ranking. Qualquer um desses eventos recarrega os relatórios abertos.
 */
export function useReportLiveUpdates(): void {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
  };
  useLiveEvents(ORDER_UPDATES_TOPIC, refresh, refresh);
  useLiveEvents(PRODUCT_UPDATES_TOPIC, refresh, refresh);
}
