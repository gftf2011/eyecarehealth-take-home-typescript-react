import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ConfirmMyDeliveryInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { MY_DELIVERIES_QUERY_KEY } from './use-my-deliveries';

/** Confirma a entrega e recarrega a tela (com sucesso ou não: o pedido pode ter mudado). */
export function useConfirmMyDelivery() {
  const { confirmMyDelivery } = useDeliveryServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, ConfirmMyDeliveryInput>({
    mutationFn: (input) => confirmMyDelivery.execute(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: MY_DELIVERIES_QUERY_KEY }),
  });
}
