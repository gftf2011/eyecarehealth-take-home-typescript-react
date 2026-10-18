import { useEffect, useRef } from 'react';

import type { LiveEvent } from '../../application';
import { useLiveEventBus } from '../providers/live-events-provider';

/**
 * Reage aos eventos de um tópico enquanto a tela está montada, e à
 * ressincronização depois de uma queda (eventos podem ter se perdido).
 * Sem o canal (ex.: testes de componente), não faz nada.
 */
export function useLiveEvents(
  topic: string,
  onEvent: (event: LiveEvent) => void,
  onResync: () => void = () => undefined,
): void {
  const bus = useLiveEventBus();
  const handlers = useRef({ onEvent, onResync });

  useEffect(() => {
    handlers.current = { onEvent, onResync };
  });

  useEffect(() => {
    if (bus === null) return undefined;
    const unsubscribe = bus.subscribe(topic, (event) => handlers.current.onEvent(event));
    const unsubscribeResync = bus.onResync(() => handlers.current.onResync());
    return () => {
      unsubscribe();
      unsubscribeResync();
    };
  }, [bus, topic]);
}
