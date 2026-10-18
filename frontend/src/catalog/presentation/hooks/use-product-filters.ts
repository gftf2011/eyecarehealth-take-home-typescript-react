import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { ListProductsInput } from '../../application';

export type ProductFilterValues = {
  readonly search: string;
  readonly category: string;
  readonly isAvailable: string;
  readonly sortBy: string;
  readonly sortOrder: string;
};

const FILTER_KEYS = ['search', 'category', 'isAvailable', 'sortBy', 'sortOrder'] as const;

/** Busca, filtros e página na URL (recarregar ou compartilhar mantém a mesma visão). */
export function useProductFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ProductFilterValues>(
    () => ({
      search: params.get('search') ?? '',
      category: params.get('category') ?? '',
      isAvailable: params.get('isAvailable') ?? '',
      sortBy: params.get('sortBy') ?? '',
      sortOrder: params.get('sortOrder') ?? '',
    }),
    [params],
  );
  const page = Number(params.get('page') ?? '1');

  const input = useMemo<ListProductsInput>(() => ({ ...filters, page }), [filters, page]);

  const applyFilters = useCallback(
    (values: ProductFilterValues) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const key of FILTER_KEYS) {
          const value = values[key].trim();
          if (value === '') next.delete(key);
          else next.set(key, value);
        }
        next.delete('page');
        return next;
      }),
    [setParams],
  );

  const goToPage = useCallback(
    (target: number) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (target <= 1) next.delete('page');
        else next.set('page', String(target));
        return next;
      }),
    [setParams],
  );

  return { filters, input, applyFilters, goToPage };
}
