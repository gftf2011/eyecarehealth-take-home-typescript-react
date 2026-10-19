import { InvalidValueError } from '../../../shared-kernel/domain';

/** Motivo ou observação do problema fora das regras da API. */
export class InvalidCourierIssueError extends InvalidValueError {
  readonly code = 'INVALID_COURIER_ISSUE';

  constructor(field: 'reason' | 'note', message: string) {
    super(field, message);
  }
}
