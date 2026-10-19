import { InvalidValueError } from '../../../../shared-kernel/domain';

export class InvalidDeliveryIssueNoteError extends InvalidValueError {
  readonly code = 'INVALID_DELIVERY_ISSUE_NOTE';

  constructor(message: string) {
    super('note', message);
  }
}
