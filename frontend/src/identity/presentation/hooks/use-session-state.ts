import { useSyncExternalStore } from 'react';

import type { SessionState } from '../../application';
import { useIdentityServices } from '../providers/identity-provider';

/** Estado da sessão, re-renderizando em login, renovação, logout e expiração. */
export function useSessionState(): SessionState {
  const { sessions } = useIdentityServices();
  return useSyncExternalStore(
    (listener) => sessions.subscribe(listener),
    () => sessions.state(),
  );
}
