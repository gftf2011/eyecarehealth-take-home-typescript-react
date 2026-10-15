import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidSessionExpirationError extends InvalidValueError {
  readonly code = 'INVALID_SESSION_EXPIRATION';

  constructor() {
    super('expiresAt', 'A expiração da sessão deve ser posterior ao instante atual');
  }
}
