import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidDeliveryIssueReasonError extends InvalidValueError {
  readonly code = 'INVALID_DELIVERY_ISSUE_REASON';

  constructor(message: string) {
    super('reason', message);
  }
}
