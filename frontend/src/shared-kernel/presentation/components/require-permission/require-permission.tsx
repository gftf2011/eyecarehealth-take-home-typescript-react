import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import type { Permission } from '../../../domain';
import { useCan } from '../../hooks/use-can';
import { cameFromLogin } from '../../navigation/after-login';
import { Alert } from '../alert/alert';

/**
 * Mostra a tela só para perfis com a permissão. Logo depois do login, uma
 * página que o perfil não pode abrir (a lembrada era de outra pessoa) leva à
 * tela inicial dele; nos outros casos (um link aberto direto), o aviso de
 * acesso negado oferece o caminho de volta.
 */
export function RequirePermission({
  permission,
  children,
}: {
  readonly permission: Permission;
  readonly children: ReactNode;
}) {
  const allowed = useCan(permission);
  const location = useLocation();
  if (allowed) return children;
  if (cameFromLogin(location.state)) return <Navigate to="/" replace />;
  return (
    <Alert tone="warning" title="Acesso negado">
      <p>Seu perfil não tem permissão para acessar esta tela.</p>
      <p>
        <Link to="/">Ir para a minha tela inicial</Link>
      </p>
    </Alert>
  );
}
