import { useQueryClient, type Query, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { RefreshThrottle, type LiveEvent } from '../../application';
import { useLiveEventsContext } from '../providers/live-events-provider';

/** Quais consultas um tópico pode desatualizar, e quais de fato desatualiza. */
export type LiveInvalidationRule = {
  readonly topic: string;
  /** Prefixo das consultas candidatas (ex.: `['orders', 'list']`). */
  readonly queryKey: QueryKey;
  /**
   * O evento muda o resultado desta consulta? Recebe a chave completa (com os
   * filtros). Sem a regra, todo evento do tópico desatualiza as candidatas.
   */
  readonly affects?: (event: LiveEvent, queryKey: QueryKey) => boolean;
};

export type LiveInvalidationOptions = {
  /** No máximo uma recarga por intervalo, por tela. Padrão: 1 s. */
  readonly intervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 1_000;

/**
 * Mantém a tela em dia com o tempo real sem multiplicar consultas:
 * - **relevância:** só as consultas que o evento afeta são invalidadas (ex.:
 *   um pedido novo `pending` não mexe na lista filtrada por `delivered`);
 * - **rajadas:** eventos próximos viram uma única recarga por intervalo;
 * - **aba em segundo plano:** só marca a consulta como desatualizada, sem
 *   requisição; ela recarrega quando a aba volta a ficar visível.
 *
 * Ao reconectar (eventos podem ter se perdido), invalida todas as
 * candidatas na hora.
 */
export function useLiveInvalidation(
  rules: readonly LiveInvalidationRule[],
  { intervalMs = DEFAULT_INTERVAL_MS }: LiveInvalidationOptions = {},
): void {
  const live = useLiveEventsContext();
  const queryClient = useQueryClient();
  const current = useRef(rules);

  useEffect(() => {
    current.current = rules;
  });

  const topicsKey = [...new Set(rules.map((rule) => rule.topic))].sort().join('|');

  useEffect(() => {
    if (live === null) return undefined;
    const refetchType = (): 'active' | 'none' => (document.visibilityState === 'hidden' ? 'none' : 'active');

    const throttle = new RefreshThrottle<LiveEvent>(live.scheduler, intervalMs, (batch) => {
      for (const rule of current.current) {
        const events = batch.filter((event) => event.topic === rule.topic);
        if (events.length === 0) continue;
        const affected = (query: Query): boolean =>
          events.some((event) => rule.affects?.(event, query.queryKey) ?? true);
        // Uma consulta em andamento pode ter começado antes da mudança: é
        // cancelada e refeita (padrão do TanStack), nunca aproveitada.
        void queryClient.invalidateQueries({ queryKey: rule.queryKey, predicate: affected, refetchType: refetchType() });
      }
    });

    const unsubscribes = topicsKey.split('|').map((topic) => live.bus.subscribe(topic, (event) => throttle.push(event)));
    unsubscribes.push(
      live.bus.onResync(() => {
        throttle.reset();
        for (const rule of current.current) {
          void queryClient.invalidateQueries({ queryKey: rule.queryKey, refetchType: refetchType() });
        }
      }),
    );
    return () => {
      throttle.reset();
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [live, queryClient, intervalMs, topicsKey]);
}
