import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ProductDto, ProductFormInput } from '../../application';
import { useCatalogServices } from '../providers/catalog-provider';
import { productQueryKeys } from '../queries/product-query-keys';

/** Cria (sem `productId`) ou edita um produto e recarrega as listagens. */
export function useSaveProduct(productId: string | null) {
  const { createProduct, updateProduct } = useCatalogServices();
  const queryClient = useQueryClient();
  return useMutation<ProductDto, Error, ProductFormInput>({
    mutationFn: (input) =>
      productId === null ? createProduct.execute(input) : updateProduct.execute({ ...input, id: productId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() }),
  });
}
