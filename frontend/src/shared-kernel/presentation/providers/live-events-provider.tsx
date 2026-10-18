import { createContext, use, type ReactNode } from 'react';

import type { LiveEventBus, Scheduler } from '../../application';

type LiveEventsContextValue = { readonly bus: LiveEventBus; readonly scheduler: Scheduler };

const LiveEventsContext = createContext<LiveEventsContextValue | null>(null);

/**
 * Disponibiliza o canal de eventos em tempo real para as telas de todos os
 * contextos, e o agendador com que elas espaçam as recargas.
 */
export function LiveEventsProvider({
  bus,
  scheduler,
  children,
}: {
  readonly bus: LiveEventBus;
  readonly scheduler: Scheduler;
  readonly children: ReactNode;
}) {
  return <LiveEventsContext value={{ bus, scheduler }}>{children}</LiveEventsContext>;
}

export function useLiveEventBus(): LiveEventBus | null {
  return use(LiveEventsContext)?.bus ?? null;
}

export function useLiveEventsContext(): LiveEventsContextValue | null {
  return use(LiveEventsContext);
}
