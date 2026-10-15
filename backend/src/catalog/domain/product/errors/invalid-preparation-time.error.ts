import { InvalidValueError } from '../../../../shared-kernel/domain/index.js';

export class InvalidPreparationTimeError extends InvalidValueError {
  readonly code = 'INVALID_PREPARATION_TIME';

  constructor(message: string) {
    super('preparationTime', message);
  }
}
