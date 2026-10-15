import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidCustomerNameError extends InvalidValueError {
  readonly code = 'INVALID_CUSTOMER_NAME';

  constructor(message: string) {
    super('customerName', message);
  }
}
