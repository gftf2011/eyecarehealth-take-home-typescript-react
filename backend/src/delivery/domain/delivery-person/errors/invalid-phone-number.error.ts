import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidPhoneNumberError extends InvalidValueError {
  readonly code = 'INVALID_PHONE_NUMBER';

  constructor(message: string) {
    super('phone', message);
  }
}
