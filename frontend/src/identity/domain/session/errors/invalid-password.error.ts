import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidPasswordError extends InvalidValueError {
  readonly code = 'INVALID_PASSWORD';

  constructor(message: string) {
    super('password', message);
  }
}
