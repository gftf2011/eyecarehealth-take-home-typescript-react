import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidPersonNameError extends InvalidValueError {
  readonly code = 'INVALID_PERSON_NAME';

  constructor(message: string) {
    super('name', message);
  }
}
