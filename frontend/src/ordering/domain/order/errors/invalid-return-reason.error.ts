import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidReturnReasonError extends InvalidValueError {
  readonly code = 'INVALID_RETURN_REASON';

  constructor(message: string) {
    super('reason', message);
  }
}
