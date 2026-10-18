import { useQueryClient } from '@tanstack/react-query';

import { useLiveEvents } from '../../../shared-kernel/presentation';
import { orderQueryKeys } from '../queries/order-query-keys';

/** Tópico público das atualizações de pedidos (contrato do backend). */
export const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/**
 * Painel em tempo real: um pedido criado ou alterado em qualquer lugar (outra
 * aba, outro gestor) recarrega as listas e o detalhe aberto. Depois de uma
 * queda da conexão, recarrega tudo (eventos podem ter se perdido).
 */
export function useOrderLiveUpdates(): void {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
  };
  useLiveEvents(ORDER_UPDATES_TOPIC, refresh, refresh);
}
