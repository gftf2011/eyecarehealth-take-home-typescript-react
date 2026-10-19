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

const CURSOR_KEY = 'cursor';

/** Busca, filtros e página (cursor) na URL: recarregar ou compartilhar mantém a mesma visão. */
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
  const cursor = params.get(CURSOR_KEY) ?? '';

  const input = useMemo<ListProductsInput>(() => ({ ...filters, cursor }), [filters, cursor]);

  const applyFilters = useCallback(
    (values: ProductFilterValues) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const key of FILTER_KEYS) {
          const value = values[key].trim();
          if (value === '') next.delete(key);
          else next.set(key, value);
        }
        // O cursor é uma posição na ordenação antiga: com outros filtros, recomeça do início.
        next.delete(CURSOR_KEY);
        return next;
      }),
    [setParams],
  );

  const goToCursor = useCallback(
    (target: string | null) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (target === null) next.delete(CURSOR_KEY);
        else next.set(CURSOR_KEY, target);
        return next;
      }),
    [setParams],
  );

  return { filters, input, applyFilters, goToCursor };
}
