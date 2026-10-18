import type { Permission } from '../../domain';
import { usePermissionsContext } from '../providers/permissions-provider';

/** Todas as permissões do usuário logado (ex.: para filtrar o menu). */
export function usePermissions(): readonly Permission[] {
  return usePermissionsContext();
}
