import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { ListOrdersInput } from '../../application';

/** Filtros editáveis na tela (a página e o pedido aberto são controlados à parte). */
export type OrderFilterValues = {
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly sortBy: string;
  readonly sortOrder: string;
};

const FILTER_KEYS = ['status', 'startDate', 'endDate', 'sortBy', 'sortOrder'] as const;
const OPEN_ORDER_KEY = 'order';
const CURSOR_KEY = 'cursor';

/**
 * Filtros, página (cursor) e pedido aberto ficam **na URL**: recarregar, voltar e
 * compartilhar o link mantêm a mesma visão do painel.
 */
export function useOrderFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<OrderFilterValues>(
    () => ({
      status: params.get('status') ?? '',
      startDate: params.get('startDate') ?? '',
      endDate: params.get('endDate') ?? '',
      sortBy: params.get('sortBy') ?? '',
      sortOrder: params.get('sortOrder') ?? '',
    }),
    [params],
  );
  const cursor = params.get(CURSOR_KEY) ?? '';
  const openOrderId = params.get(OPEN_ORDER_KEY);

  const input = useMemo<ListOrdersInput>(() => ({ ...filters, cursor }), [filters, cursor]);

  const update = useCallback(
    (change: (next: URLSearchParams) => void) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
      });
    },
    [setParams],
  );

  /**
   * Aplica novos filtros e volta para a primeira página: o cursor é uma
   * posição na ordenação antiga.
   */
  const applyFilters = useCallback(
    (values: OrderFilterValues) =>
      update((next) => {
        for (const key of FILTER_KEYS) setOrDelete(next, key, values[key]);
        next.delete(CURSOR_KEY);
      }),
    [update],
  );

  /** `null` = primeira página. */
  const goToCursor = useCallback(
    (target: string | null) => update((next) => setOrDelete(next, CURSOR_KEY, target ?? '')),
    [update],
  );

  const openOrder = useCallback((id: string) => update((next) => next.set(OPEN_ORDER_KEY, id)), [update]);
  const closeOrder = useCallback(() => update((next) => next.delete(OPEN_ORDER_KEY)), [update]);

  return { filters, input, openOrderId, applyFilters, goToCursor, openOrder, closeOrder };
}

function setOrDelete(params: URLSearchParams, key: string, value: string): void {
  if (value.trim() === '') params.delete(key);
  else params.set(key, value.trim());
}
