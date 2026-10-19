import { Navigate } from 'react-router';

import { Alert, usePermissions, type NavigationItem } from '../../../shared-kernel/presentation';

/**
 * A página inicial depende do perfil: o painel abre nos pedidos; o
 * entregador, nas próprias entregas. É a primeira tela do menu que o perfil
 * pode abrir.
 */
export function HomeRedirect({ navigation }: { readonly navigation: readonly NavigationItem[] }) {
  const permissions = usePermissions();
  const home = navigation.find((item) => permissions.includes(item.permission));

  return home === undefined ? (
    <Alert tone="warning" title="Nenhuma tela disponível">
      Seu perfil não tem acesso a nenhuma tela do painel.
    </Alert>
  ) : (
    <Navigate to={home.path} replace />
  );
}
