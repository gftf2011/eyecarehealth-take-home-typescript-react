import type { ReactNode } from 'react';

import { PermissionsProvider } from '../../../../shared-kernel/presentation';
import { useCurrentSession } from '../../hooks/use-current-session';

/** Publica as permissões da sessão atual para as telas dos outros contextos. */
export function SessionPermissions({ children }: { readonly children: ReactNode }) {
  const session = useCurrentSession();
  return <PermissionsProvider permissions={session?.permissions ?? []}>{children}</PermissionsProvider>;
}
