import { AuthorizationError } from '../../../../shared-kernel/domain/index.js';
import type { Permission } from '../value-objects/permission.js';
import type { RoleValue } from '../value-objects/role.js';

export class PermissionDeniedError extends AuthorizationError {
  readonly code = 'FORBIDDEN';

  constructor(role: RoleValue, permission: Permission) {
    super('Permissão insuficiente para esta ação', [{ role, permission }]);
  }
}
