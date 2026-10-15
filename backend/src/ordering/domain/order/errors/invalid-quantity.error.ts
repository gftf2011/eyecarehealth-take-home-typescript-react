import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidQuantityError extends InvalidValueError {
  readonly code = 'INVALID_QUANTITY';

  constructor(message: string) {
    super('quantity', message);
  }
}
