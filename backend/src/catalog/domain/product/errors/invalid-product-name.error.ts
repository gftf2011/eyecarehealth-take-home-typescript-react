import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidProductNameError extends InvalidValueError {
  readonly code = 'INVALID_PRODUCT_NAME';

  constructor(message: string) {
    super('name', message);
  }
}
