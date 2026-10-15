import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidEmailError extends InvalidValueError {
  readonly code = 'INVALID_EMAIL';

  constructor(message: string) {
    super('email', message);
  }
}
