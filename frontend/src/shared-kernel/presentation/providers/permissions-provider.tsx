import { createContext, use, type ReactNode } from 'react';

import type { Permission } from '../../domain';

const PermissionsContext = createContext<readonly Permission[]>([]);

/**
 * Permissões do usuário logado para as telas de todos os contextos. Quem
 * fornece é o Identity (montado em `main`); os outros contextos só perguntam
 * "posso?", sem depender dele.
 */
export function PermissionsProvider({
  permissions,
  children,
}: {
  readonly permissions: readonly Permission[];
  readonly children: ReactNode;
}) {
  return <PermissionsContext value={permissions}>{children}</PermissionsContext>;
}

export function usePermissionsContext(): readonly Permission[] {
  return use(PermissionsContext);
}
