import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidProductCategoryError extends InvalidValueError {
  readonly code = 'INVALID_PRODUCT_CATEGORY';

  constructor(message: string) {
    super('category', message);
  }
}
