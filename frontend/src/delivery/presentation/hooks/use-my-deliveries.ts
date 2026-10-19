import { useQuery } from '@tanstack/react-query';

import { useDeliveryServices } from '../providers/delivery-provider';

export const MY_DELIVERIES_QUERY_KEY = ['delivery', 'my-deliveries'] as const;

/** As entregas do entregador logado (sempre buscadas de novo ao abrir a tela). */
export function useMyDeliveries() {
  const { loadMyDeliveries } = useDeliveryServices();
  return useQuery({
    queryKey: MY_DELIVERIES_QUERY_KEY,
    queryFn: ({ signal }) => loadMyDeliveries.execute({ signal }),
    staleTime: 0,
  });
}
