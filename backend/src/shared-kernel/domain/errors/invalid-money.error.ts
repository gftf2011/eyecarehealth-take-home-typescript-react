import { InvalidValueError } from './domain-error';

export class InvalidMoneyError extends InvalidValueError {
  readonly code = 'INVALID_MONEY';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
