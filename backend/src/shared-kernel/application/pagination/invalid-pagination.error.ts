import { InvalidValueError } from '../../domain';

export class InvalidPaginationError extends InvalidValueError {
  readonly code = 'INVALID_PAGINATION';

  constructor(field: 'page' | 'limit', message: string) {
    super(field, message);
  }
}
