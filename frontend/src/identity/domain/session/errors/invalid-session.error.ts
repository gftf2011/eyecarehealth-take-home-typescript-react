import { InvalidValueError } from '../../../../shared-kernel/domain';

/** A API devolveu uma sessão incoerente (token vazio, expiração inválida). */
export class InvalidSessionError extends InvalidValueError {
  readonly code = 'INVALID_SESSION';

  constructor(field: string, message: string) {
    super(field, message);
  }
}
