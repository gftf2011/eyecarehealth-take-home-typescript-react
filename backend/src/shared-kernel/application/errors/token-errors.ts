import { AuthenticationError } from '../../domain';

/** Token de acesso ausente, malformado ou com assinatura inválida. */
export class InvalidTokenError extends AuthenticationError {
  readonly code = 'INVALID_TOKEN';

  constructor(message = 'Token de acesso ausente ou inválido') {
    super(message);
  }
}

/** Token de acesso válido, mas vencido: o cliente deve renovar a sessão. */
export class TokenExpiredError extends AuthenticationError {
  readonly code = 'TOKEN_EXPIRED';

  constructor() {
    super('Token de acesso expirado');
  }
}
