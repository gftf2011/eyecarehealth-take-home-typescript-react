import { createContext, use, type ReactNode } from 'react';

import type { LiveStatus } from '../../domain';

/** Estado observável da conexão (o `LiveConnection` implementa). */
export type LiveStatusSource = {
  status(): LiveStatus;
  subscribe(listener: () => void): () => void;
};

const RealtimeContext = createContext<LiveStatusSource | null>(null);

export function RealtimeProvider({
  connection,
  children,
}: {
  readonly connection: LiveStatusSource;
  readonly children: ReactNode;
}) {
  return <RealtimeContext value={connection}>{children}</RealtimeContext>;
}

export function useLiveStatusSource(): LiveStatusSource | null {
  return use(RealtimeContext);
}
