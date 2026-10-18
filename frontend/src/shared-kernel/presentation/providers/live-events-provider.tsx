import { createContext, use, type ReactNode } from 'react';

import type { LiveEventBus } from '../../application';

const LiveEventsContext = createContext<LiveEventBus | null>(null);

/** Disponibiliza o canal de eventos em tempo real para as telas de todos os contextos. */
export function LiveEventsProvider({ bus, children }: { readonly bus: LiveEventBus; readonly children: ReactNode }) {
  return <LiveEventsContext value={bus}>{children}</LiveEventsContext>;
}

export function useLiveEventBus(): LiveEventBus | null {
  return use(LiveEventsContext);
}
