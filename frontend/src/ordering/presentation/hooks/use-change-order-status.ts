import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ChangeOrderStatusInput, OrderDto } from '../../application';
import { useOrderingServices } from '../providers/ordering-provider';
import { orderQueryKeys } from '../queries/order-query-keys';

/**
 * Muda o status. Com sucesso, o detalhe recebe o pedido devolvido pela API e
 * as listas são recarregadas (o pedido pode ter saído do filtro atual).
 */
export function useChangeOrderStatus() {
  const { changeOrderStatus } = useOrderingServices();
  const queryClient = useQueryClient();
  return useMutation<OrderDto, Error, ChangeOrderStatusInput>({
    mutationFn: (input) => changeOrderStatus.execute(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(orderQueryKeys.detail(order.id), order);
      await queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    },
  });
}
