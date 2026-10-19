import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { OrderDto, ResolveDeliveryIssueInput } from '../../application';
import { useOrderingServices } from '../providers/ordering-provider';
import { orderQueryKeys } from '../queries/order-query-keys';

/** Tentar de novo ou cancelar a entrega que falhou; o detalhe recebe o pedido e as listas recarregam. */
export function useResolveDeliveryIssue() {
  const { resolveDeliveryIssue } = useOrderingServices();
  const queryClient = useQueryClient();
  return useMutation<OrderDto, Error, ResolveDeliveryIssueInput>({
    mutationFn: (input) => resolveDeliveryIssue.execute(input),
    onSuccess: async (order) => {
      queryClient.setQueryData(orderQueryKeys.detail(order.id), order);
      await queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    },
  });
}
