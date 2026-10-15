import { AuthorizationError } from '../../../../shared-kernel/domain';
import type { Permission } from '../value-objects/permission';
import type { RoleValue } from '../value-objects/role';

export class PermissionDeniedError extends AuthorizationError {
  readonly code = 'FORBIDDEN';

  constructor(role: RoleValue, permission: Permission) {
    super('Permissão insuficiente para esta ação', [{ role, permission }]);
  }
}
