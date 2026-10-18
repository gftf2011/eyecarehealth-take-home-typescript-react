import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { RemoveProductInput } from '../../application';
import { useCatalogServices } from '../providers/catalog-provider';
import { productQueryKeys } from '../queries/product-query-keys';

export function useRemoveProduct() {
  const { removeProduct } = useCatalogServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, RemoveProductInput>({
    mutationFn: (input) => removeProduct.execute(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() }),
  });
}
