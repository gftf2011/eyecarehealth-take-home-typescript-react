import type { Permission } from '../../domain';
import { usePermissionsContext } from '../providers/permissions-provider';

/** O perfil do usuário logado tem a permissão? (só guia a interface; a API decide.) */
export function useCan(permission: Permission): boolean {
  return usePermissionsContext().includes(permission);
}
