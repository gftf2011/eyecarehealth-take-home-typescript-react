import { useSyncExternalStore } from 'react';

import type { LiveStatus } from '../../domain';
import { useLiveStatusSource } from '../providers/realtime-provider';

const noop = (): (() => void) => () => undefined;

/** Estado da conexão em tempo real, re-renderizando a cada mudança. */
export function useLiveStatus(): LiveStatus {
  const source = useLiveStatusSource();
  return useSyncExternalStore(
    source === null ? noop : (listener) => source.subscribe(listener),
    () => source?.status() ?? 'idle',
  );
}
