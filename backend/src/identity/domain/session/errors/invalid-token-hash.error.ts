import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidTokenHashError extends InvalidValueError {
  readonly code = 'INVALID_TOKEN_HASH';

  constructor(message: string) {
    super('tokenHash', message);
  }
}
