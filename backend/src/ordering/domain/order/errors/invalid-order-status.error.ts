import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidOrderStatusError extends InvalidValueError {
  readonly code = 'INVALID_ORDER_STATUS';

  constructor(message: string) {
    super('status', message);
  }
}
