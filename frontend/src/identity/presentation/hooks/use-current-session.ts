import { useMemo } from 'react';

import { toSessionDto, type SessionDto } from '../../application';
import { useSessionState } from './use-session-state';

/** Sessão autenticada atual (usuário e permissões), ou `null`. */
export function useCurrentSession(): SessionDto | null {
  const state = useSessionState();
  const session = state.status === 'authenticated' ? state.session : null;
  return useMemo(() => (session === null ? null : toSessionDto(session)), [session]);
}
