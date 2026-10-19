import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { OrderDto, ReturnOrderToAssignmentInput } from '../../application';
import { useOrderingServices } from '../providers/ordering-provider';
import { orderQueryKeys } from '../queries/order-query-keys';

/** Devolve a entrega para a atribuição: o detalhe recebe o pedido devolvido e as listas recarregam. */
export function useReturnOrderToAssignment() {
  const { returnOrderToAssignment } = useOrderingServices();
  const queryClient = useQueryClient();
  return useMutation<OrderDto, Error, ReturnOrderToAssignmentInput>({
    mutationFn: (input) => returnOrderToAssignment.execute(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(orderQueryKeys.detail(order.id), order);
      await queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    },
  });
}
