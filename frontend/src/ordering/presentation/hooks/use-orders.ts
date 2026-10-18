import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ListOrdersInput } from '../../application';
import { useOrderingServices } from '../providers/ordering-provider';
import { orderQueryKeys } from '../queries/order-query-keys';

/**
 * Página de pedidos para os filtros. Ao trocar de página ou filtro, a lista
 * anterior continua na tela até a nova chegar (sem "piscar" vazia).
 */
export function useOrders(input: ListOrdersInput) {
  const { listOrders } = useOrderingServices();
  return useQuery({
    queryKey: orderQueryKeys.list(input),
    queryFn: ({ signal }) => listOrders.execute({ ...input, signal }),
    placeholderData: keepPreviousData,
  });
}
