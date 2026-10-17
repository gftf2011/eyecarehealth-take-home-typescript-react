import { InvalidValueError } from '../../domain';

/** Campo obrigatório ausente na entrada de um caso de uso. */
export class RequiredFieldError extends InvalidValueError {
  readonly code = 'REQUIRED_FIELD';

  constructor(field: string) {
    super(field, 'Campo obrigatório');
  }
}
