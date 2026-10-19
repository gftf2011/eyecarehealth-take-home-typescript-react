import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

import type { DeliveryPersonDto, SetDeliveryPersonActivationInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { deliveryPersonQueryKeys } from '../queries/delivery-person-query-keys';

type Snapshot = readonly (readonly [QueryKey, readonly DeliveryPersonDto[] | undefined])[];

/**
 * Ativa/desativa com **atualização otimista**: o switch muda na hora em todas
 * as listas em cache; se a API recusar, volta ao estado anterior. No fim, as
 * listas são recarregadas (o filtro por ativação pode tirar a pessoa da lista).
 */
export function useSetDeliveryPersonActivation() {
  const { setDeliveryPersonActivation } = useDeliveryServices();
  const queryClient = useQueryClient();

  return useMutation<DeliveryPersonDto, Error, SetDeliveryPersonActivationInput, Snapshot>({
    mutationFn: (input) => setDeliveryPersonActivation.execute(input),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: deliveryPersonQueryKeys.lists() });
      const snapshot = queryClient.getQueriesData<readonly DeliveryPersonDto[]>({
        queryKey: deliveryPersonQueryKeys.lists(),
      });
      queryClient.setQueriesData<readonly DeliveryPersonDto[]>({ queryKey: deliveryPersonQueryKeys.lists() }, (list) =>
        list?.map((person) => (person.id === id ? { ...person, isActive } : person)),
      );
      return snapshot;
    },
    onError: (_error, _input, snapshot) => {
      for (const [key, list] of snapshot ?? []) queryClient.setQueryData(key, list);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: deliveryPersonQueryKeys.lists() }),
  });
}
