import type { ListProductsInput } from '../../application';

export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (input: ListProductsInput) => [...productQueryKeys.lists(), input] as const,
};
