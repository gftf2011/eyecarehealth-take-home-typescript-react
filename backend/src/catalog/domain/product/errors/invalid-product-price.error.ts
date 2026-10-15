import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidProductPriceError extends InvalidValueError {
  readonly code = 'INVALID_PRODUCT_PRICE';

  constructor(message: string) {
    super('price', message);
  }
}
