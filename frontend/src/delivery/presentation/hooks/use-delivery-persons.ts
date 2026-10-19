import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ListDeliveryPersonsInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { deliveryPersonQueryKeys } from '../queries/delivery-person-query-keys';

/** Entregadores para os filtros; a lista anterior fica na tela até a nova chegar. */
export function useDeliveryPersons(input: ListDeliveryPersonsInput) {
  const { listDeliveryPersons } = useDeliveryServices();
  return useQuery({
    queryKey: deliveryPersonQueryKeys.list(input),
    queryFn: ({ signal }) => listDeliveryPersons.execute({ ...input, signal }),
    placeholderData: keepPreviousData,
  });
}
