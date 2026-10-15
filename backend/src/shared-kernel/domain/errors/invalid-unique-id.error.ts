import { InvalidValueError } from './domain-error';

export class InvalidUniqueIdError extends InvalidValueError {
  readonly code = 'INVALID_ID';

  constructor(field: string, raw: string) {
    super(field, `O identificador '${raw}' não é um UUID válido`);
  }
}
