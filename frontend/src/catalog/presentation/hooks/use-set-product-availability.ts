import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

import type { Page } from '../../../shared-kernel/application';
import type { ProductDto, SetProductAvailabilityInput } from '../../application';
import { useCatalogServices } from '../providers/catalog-provider';
import { productQueryKeys } from '../queries/product-query-keys';

type Snapshot = readonly (readonly [QueryKey, Page<ProductDto> | undefined])[];

/**
 * Alterna a disponibilidade com **atualização otimista**: o switch muda na
 * hora em todas as listas em cache; se a API recusar, volta ao estado
 * anterior. No fim, as listas são recarregadas (um filtro por
 * disponibilidade pode tirar o produto da página).
 */
export function useSetProductAvailability() {
  const { setProductAvailability } = useCatalogServices();
  const queryClient = useQueryClient();

  return useMutation<ProductDto, Error, SetProductAvailabilityInput, Snapshot>({
    mutationFn: (input) => setProductAvailability.execute(input),
    onMutate: async ({ id, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: productQueryKeys.lists() });
      const snapshot = queryClient.getQueriesData<Page<ProductDto>>({ queryKey: productQueryKeys.lists() });
      queryClient.setQueriesData<Page<ProductDto>>({ queryKey: productQueryKeys.lists() }, (page) =>
        page === undefined
          ? page
          : { ...page, data: page.data.map((product) => (product.id === id ? { ...product, isAvailable } : product)) },
      );
      return snapshot;
    },
    onError: (_error, _input, snapshot) => {
      for (const [key, page] of snapshot ?? []) queryClient.setQueryData(key, page);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() }),
  });
}
