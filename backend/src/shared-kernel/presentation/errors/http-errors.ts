import {
  AuthenticationError,
  AuthorizationError,
  DomainError,
  NotFoundError,
  type Permission,
} from '../../domain';

/** Token ausente, malformado ou com assinatura inválida. */
export class InvalidTokenError extends AuthenticationError {
  readonly code = 'INVALID_TOKEN';

  constructor(message = 'Token de acesso ausente ou inválido') {
    super(message);
  }
}

export class TokenExpiredError extends AuthenticationError {
  readonly code = 'TOKEN_EXPIRED';

  constructor() {
    super('Token de acesso expirado');
  }
}

export class ForbiddenError extends AuthorizationError {
  readonly code = 'FORBIDDEN';

  constructor(permission: Permission) {
    super('Permissão insuficiente para esta ação', [{ permission }]);
  }
}

export class RouteNotFoundError extends NotFoundError {
  readonly code = 'ROUTE_NOT_FOUND';

  constructor(method: string, url: string) {
    super(`Rota ${method} ${url} não encontrada`);
  }
}

/** Corpo da requisição não é um JSON válido. */
export class MalformedRequestError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}

export class RateLimitExceededError extends DomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(retryAfterSeconds: number) {
    super('Limite de requisições atingido. Tente novamente em instantes.', [
      { retryAfterSeconds },
    ]);
  }
}
