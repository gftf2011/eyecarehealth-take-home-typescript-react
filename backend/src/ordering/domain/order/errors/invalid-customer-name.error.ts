import { InvalidValueError } from '../../../../shared-kernel/domain/index';

export class InvalidCustomerNameError extends InvalidValueError {
  readonly code = 'INVALID_CUSTOMER_NAME';

  constructor(message: string) {
    super('customerName', message);
  }
}
