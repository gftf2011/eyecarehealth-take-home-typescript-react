import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidPasswordHashError extends InvalidValueError {
  readonly code = 'INVALID_PASSWORD_HASH';

  constructor(message: string) {
    super('passwordHash', message);
  }
}
