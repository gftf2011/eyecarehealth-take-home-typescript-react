import type { ReactNode } from 'react';

import type { Permission } from '../../../domain';
import { useCan } from '../../hooks/use-can';
import { Alert } from '../alert/alert';

/** Mostra a tela só para perfis com a permissão; os demais veem um aviso de acesso negado. */
export function RequirePermission({
  permission,
  children,
}: {
  readonly permission: Permission;
  readonly children: ReactNode;
}) {
  const allowed = useCan(permission);
  if (allowed) return children;
  return (
    <Alert tone="warning" title="Acesso negado">
      Seu perfil não tem permissão para acessar esta tela.
    </Alert>
  );
}
