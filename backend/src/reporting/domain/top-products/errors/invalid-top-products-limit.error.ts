import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidTopProductsLimitError extends InvalidValueError {
  readonly code = 'INVALID_LIMIT';

  constructor(min: number, max: number) {
    super('limit', `O limite deve ser um inteiro entre ${min} e ${max}`);
  }
}
