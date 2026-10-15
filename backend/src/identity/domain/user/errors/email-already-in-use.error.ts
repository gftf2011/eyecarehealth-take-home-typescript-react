import { ConflictError } from '../../../../shared-kernel/domain';
import type { Email } from '../value-objects/email';

export class EmailAlreadyInUseError extends ConflictError {
  readonly code = 'EMAIL_ALREADY_IN_USE';

  constructor(email: Email) {
    super('Já existe um usuário com este email', [{ email: email.value }]);
  }
}
