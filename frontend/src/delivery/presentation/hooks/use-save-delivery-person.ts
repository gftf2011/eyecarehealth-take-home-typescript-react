import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DeliveryPersonDto, DeliveryPersonFormInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { deliveryPersonQueryKeys } from '../queries/delivery-person-query-keys';

/** Cadastra (sem `deliveryPersonId`) ou edita um entregador e recarrega as listas. */
export function useSaveDeliveryPerson(deliveryPersonId: string | null) {
  const { registerDeliveryPerson, updateDeliveryPerson } = useDeliveryServices();
  const queryClient = useQueryClient();
  return useMutation<DeliveryPersonDto, Error, DeliveryPersonFormInput>({
    mutationFn: (input) =>
      deliveryPersonId === null
        ? registerDeliveryPerson.execute(input)
        : updateDeliveryPerson.execute({ ...input, id: deliveryPersonId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveryPersonQueryKeys.lists() }),
  });
}
