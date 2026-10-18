import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidOrderStatusError extends InvalidValueError {
  readonly code = 'INVALID_ORDER_STATUS';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
