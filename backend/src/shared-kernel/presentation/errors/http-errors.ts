import {
  AuthorizationError,
  DomainError,
  NotFoundError,
  TooManyRequestsError,
  type Permission,
} from '../../domain';

export { InvalidTokenError, TokenExpiredError } from '../../application/errors/token-errors';

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

export class RateLimitExceededError extends TooManyRequestsError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(retryAfterSeconds: number) {
    super('Limite de requisições atingido. Tente novamente em instantes.', [
      { retryAfterSeconds },
    ]);
  }
}
