import { useQuery } from '@tanstack/react-query';

import { useDeliveryServices } from '../providers/delivery-provider';

export const DISPATCH_BOARD_QUERY_KEY = ['delivery', 'dispatch-board'] as const;

/** Pedidos prontos e entregadores disponíveis (sempre buscados de novo ao abrir a tela). */
export function useDispatchBoard() {
  const { loadDispatchBoard } = useDeliveryServices();
  return useQuery({
    queryKey: DISPATCH_BOARD_QUERY_KEY,
    queryFn: ({ signal }) => loadDispatchBoard.execute({ signal }),
    staleTime: 0,
  });
}
