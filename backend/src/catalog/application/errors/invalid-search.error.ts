import { InvalidValueError } from '../../../shared-kernel/domain/index.js';

export class InvalidSearchError extends InvalidValueError {
  readonly code = 'INVALID_SEARCH';

  constructor(maxLength: number) {
    super('search', `A busca deve ter no máximo ${maxLength} caracteres`);
  }
}
