import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { SplashScreen } from '../../../../shared-kernel/presentation';
import type { SessionEndReason } from '../../../application';
import { useSessionState } from '../../hooks/use-session-state';

/** Estado de navegação que a tela de login recebe ao ser aberta por um guard. */
export type LoginRedirectState = {
  readonly from?: string;
  readonly reason?: SessionEndReason | null;
};

/**
 * Guard das telas do painel: enquanto a sessão é restaurada mostra o
 * carregamento; sem sessão, manda para o login lembrando a página pedida e o
 * motivo (ex.: sessão expirada).
 */
export function RequireSession({ children }: { readonly children: ReactNode }) {
  const state = useSessionState();
  const location = useLocation();

  if (state.status === 'restoring') return <SplashScreen />;
  if (state.status === 'anonymous') {
    const redirect: LoginRedirectState = {
      from: `${location.pathname}${location.search}`,
      reason: state.endedBy,
    };
    return <Navigate to="/login" replace state={redirect} />;
  }
  return children;
}
