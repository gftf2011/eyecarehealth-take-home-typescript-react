import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ListProductsInput } from '../../application';
import { useCatalogServices } from '../providers/catalog-provider';
import { productQueryKeys } from '../queries/product-query-keys';

/** Página de produtos para a busca e os filtros; a anterior fica na tela até a nova chegar. */
export function useProducts(input: ListProductsInput) {
  const { listProducts } = useCatalogServices();
  return useQuery({
    queryKey: productQueryKeys.list(input),
    queryFn: ({ signal }) => listProducts.execute({ ...input, signal }),
    placeholderData: keepPreviousData,
  });
}
