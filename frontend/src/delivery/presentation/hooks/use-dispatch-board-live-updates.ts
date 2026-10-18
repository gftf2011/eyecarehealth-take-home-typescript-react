import { useQueryClient } from '@tanstack/react-query';

import { useLiveEvents } from '../../../shared-kernel/presentation';
import { DISPATCH_BOARD_QUERY_KEY } from './use-dispatch-board';

/** Tópico público das atualizações de pedidos (contrato do backend). */
const ORDER_UPDATES_TOPIC = 'ordering.order-updates';

/**
 * Um pedido ficou pronto ou foi despachado em outro lugar: o quadro de
 * pedidos prontos e entregadores livres recarrega sozinho.
 */
export function useDispatchBoardLiveUpdates(): void {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: DISPATCH_BOARD_QUERY_KEY });
  };
  useLiveEvents(ORDER_UPDATES_TOPIC, refresh, refresh);
}
