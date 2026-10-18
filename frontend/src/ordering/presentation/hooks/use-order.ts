import { useQuery } from '@tanstack/react-query';

import { useOrderingServices } from '../providers/ordering-provider';
import { orderQueryKeys } from '../queries/order-query-keys';

/** Detalhe de um pedido; `null` não busca nada (modal fechado). */
export function useOrder(id: string | null) {
  const { getOrder } = useOrderingServices();
  return useQuery({
    queryKey: orderQueryKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getOrder.execute({ id: id ?? '', signal }),
    enabled: id !== null,
  });
}
