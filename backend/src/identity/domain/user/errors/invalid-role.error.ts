import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidRoleError extends InvalidValueError {
  readonly code = 'INVALID_ROLE';

  constructor(message: string) {
    super('role', message);
  }
}
