import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidProductDescriptionError extends InvalidValueError {
  readonly code = 'INVALID_PRODUCT_DESCRIPTION';

  constructor(message: string) {
    super('description', message);
  }
}
