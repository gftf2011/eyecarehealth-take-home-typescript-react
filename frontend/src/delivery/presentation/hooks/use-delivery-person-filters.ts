import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { ListDeliveryPersonsInput } from '../../application';

export type DeliveryPersonFilterValues = {
  readonly isActive: string;
  readonly available: string;
};

const FILTER_KEYS = ['isActive', 'available'] as const;

/** Filtros na URL (recarregar ou compartilhar mantém a mesma visão). */
export function useDeliveryPersonFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<DeliveryPersonFilterValues>(
    () => ({ isActive: params.get('isActive') ?? '', available: params.get('available') ?? '' }),
    [params],
  );

  const input = useMemo<ListDeliveryPersonsInput>(() => ({ ...filters }), [filters]);

  const applyFilters = useCallback(
    (values: DeliveryPersonFilterValues) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const key of FILTER_KEYS) {
          const value = values[key].trim();
          if (value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      }),
    [setParams],
  );

  return { filters, input, applyFilters };
}
