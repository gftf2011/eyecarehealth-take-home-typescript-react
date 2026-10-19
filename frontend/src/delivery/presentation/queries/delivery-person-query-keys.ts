import type { ListDeliveryPersonsInput } from '../../application';

export const deliveryPersonQueryKeys = {
  all: ['delivery-persons'] as const,
  lists: () => [...deliveryPersonQueryKeys.all, 'list'] as const,
  list: (input: ListDeliveryPersonsInput) => [...deliveryPersonQueryKeys.lists(), input] as const,
};
