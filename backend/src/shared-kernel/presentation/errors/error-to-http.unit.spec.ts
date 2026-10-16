import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../application';
import {
  AuthenticationError,
  AuthorizationError,
  BusinessRuleViolationError,
  ConflictError,
  DomainError,
  InvalidMoneyError,
  NotFoundError,
} from '../../domain';
import { errorToHttp } from './error-to-http';
import { MalformedRequestError, RateLimitExceededError } from './http-errors';

class SampleNotFound extends NotFoundError {
  readonly code = 'SAMPLE_NOT_FOUND';
  constructor() {
    super('Amostra não encontrada', [{ sampleId: '42' }]);
  }
}
class SampleConflict extends ConflictError {
  readonly code = 'SAMPLE_IN_USE';
  constructor() {
    super('Amostra em uso');
  }
}
class SampleRule extends BusinessRuleViolationError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  constructor() {
    super('Transição inválida');
  }
}
class SampleAuthentication extends AuthenticationError {
  readonly code = 'INVALID_TOKEN';
  constructor() {
    super('Token inválido');
  }
}
class SampleAuthorization extends AuthorizationError {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('Proibido');
  }
}
class UncategorizedDomainError extends DomainError {
  readonly code = 'SOMETHING';
  constructor() {
    super('Sem categoria');
  }
}

describe('errorToHttp', () => {
  it.each([
    [new InputValidationError([{ field: 'price', message: 'inválido' }]), 400, 'VALIDATION_ERROR'],
    [new MalformedRequestError('JSON inválido'), 400, 'VALIDATION_ERROR'],
    [new SampleAuthentication(), 401, 'INVALID_TOKEN'],
    [new SampleAuthorization(), 403, 'FORBIDDEN'],
    [new SampleNotFound(), 404, 'SAMPLE_NOT_FOUND'],
    [new SampleConflict(), 409, 'SAMPLE_IN_USE'],
    [new SampleRule(), 422, 'INVALID_STATUS_TRANSITION'],
    [new RateLimitExceededError(30), 429, 'RATE_LIMIT_EXCEEDED'],
    [new UncategorizedDomainError(), 500, 'SOMETHING'],
  ] as const)('%s → %d %s', (error, status, code) => {
    const response = errorToHttp(error);
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
  });

  it('erro de um único valor vira VALIDATION_ERROR com o detalhe do campo', () => {
    const response = errorToHttp(new InvalidMoneyError('price', 'O valor não pode ser negativo'));

    expect(response).toEqual({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: [{ field: 'price', message: 'O valor não pode ser negativo' }],
        },
      },
    });
  });

  it('inclui details só quando houver', () => {
    expect(errorToHttp(new SampleNotFound()).body.error.details).toEqual([{ sampleId: '42' }]);
    expect('details' in errorToHttp(new SampleConflict()).body.error).toBe(false);
  });

  it('nunca expõe detalhes de erros inesperados', () => {
    const response = errorToHttp(new TypeError('cannot read properties of undefined (password)'));

    expect(response).toEqual({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } },
    });
  });
});
