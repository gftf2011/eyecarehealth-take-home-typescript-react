import { Navigate, useLocation } from 'react-router';

import { Alert } from '../../../../shared-kernel/presentation';
import type { SessionEndReason } from '../../../application';
import { LoginForm } from '../../components/login-form/login-form';
import type { LoginRedirectState } from '../../components/require-session/require-session';
import { useLogin } from '../../hooks/use-login';
import { useSessionState } from '../../hooks/use-session-state';
import styles from './login-page.module.css';

const END_MESSAGES: Readonly<Record<SessionEndReason, string>> = {
  expired: 'Sua sessão expirou. Entre novamente para continuar.',
  'signed-out': 'Você saiu do painel.',
};

/**
 * Tela de login. Com a sessão autenticada (login aceito ou já logado), segue
 * para a página que o usuário tentou abrir, ou para o painel.
 */
export function LoginPage() {
  const state = useSessionState();
  const login = useLogin();
  const redirect = readRedirectState(useLocation().state);

  if (state.status === 'authenticated') {
    return <Navigate to={redirect.from ?? '/'} replace />;
  }

  const reason = redirect.reason ?? (state.status === 'anonymous' ? state.endedBy : null);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <header className={styles.header}>
          <span className={styles.brand} aria-hidden="true">
            FM
          </span>
          <h1 id="login-title" className={styles.title}>
            FastMeals
          </h1>
          <p className={styles.subtitle}>Entre para gerenciar pedidos, cardápio e entregas.</p>
        </header>

        {reason === null || login.isPending ? null : <Alert tone="info">{END_MESSAGES[reason]}</Alert>}

        <LoginForm
          onSubmit={(input) => login.mutate(input)}
          pending={login.isPending}
          error={login.error}
        />
      </section>
    </main>
  );
}

function readRedirectState(value: unknown): LoginRedirectState {
  if (typeof value !== 'object' || value === null) return {};
  const { from, reason } = value as Record<string, unknown>;
  const safeFrom = typeof from === 'string' && from.startsWith('/') && from !== '/login' ? from : undefined;
  const safeReason = reason === 'expired' || reason === 'signed-out' ? reason : undefined;
  return {
    ...(safeFrom === undefined ? {} : { from: safeFrom }),
    ...(safeReason === undefined ? {} : { reason: safeReason }),
  };
}
