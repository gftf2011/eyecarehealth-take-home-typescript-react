import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { RemoveDeliveryPersonInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { deliveryPersonQueryKeys } from '../queries/delivery-person-query-keys';

export function useRemoveDeliveryPerson() {
  const { removeDeliveryPerson } = useDeliveryServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, RemoveDeliveryPersonInput>({
    mutationFn: (input) => removeDeliveryPerson.execute(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryPersonQueryKeys.lists() }),
  });
}
