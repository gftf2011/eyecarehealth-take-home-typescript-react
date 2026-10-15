import { ConflictError } from '../../../../shared-kernel/domain/index.js';
import type { Email } from '../value-objects/email.js';

export class EmailAlreadyInUseError extends ConflictError {
  readonly code = 'EMAIL_ALREADY_IN_USE';

  constructor(email: Email) {
    super('Já existe um usuário com este email', [{ email: email.value }]);
  }
}
