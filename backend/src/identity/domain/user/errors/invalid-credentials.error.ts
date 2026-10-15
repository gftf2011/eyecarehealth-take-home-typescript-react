import { AuthenticationError } from '../../../../shared-kernel/domain/index';

/**
 * Email ou senha incorretos. A mensagem é a mesma nos dois casos para não
 * revelar quais emails estão cadastrados.
 */
export class InvalidCredentialsError extends AuthenticationError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Email ou senha inválidos');
  }
}
