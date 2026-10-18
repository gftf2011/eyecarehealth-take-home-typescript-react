import type { ListOrdersInput } from '../../application';

/** Chaves do cache de pedidos: invalidar `all` atualiza listas e detalhes de uma vez. */
export const orderQueryKeys = {
  all: ['orders'] as const,
  lists: () => [...orderQueryKeys.all, 'list'] as const,
  list: (input: ListOrdersInput) => [...orderQueryKeys.lists(), input] as const,
  details: () => [...orderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderQueryKeys.details(), id] as const,
};
