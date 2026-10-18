import type { Permission } from '../../../shared-kernel/domain';
import { useCurrentSession } from './use-current-session';

/** O perfil do usuário logado tem a permissão? (só guia a interface; a API decide.) */
export function useCan(permission: Permission): boolean {
  const session = useCurrentSession();
  return session?.permissions.includes(permission) ?? false;
}
