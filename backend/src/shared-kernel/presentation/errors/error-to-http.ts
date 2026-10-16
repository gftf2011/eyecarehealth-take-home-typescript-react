import { InputValidationError } from '../../application';
import {
  AuthenticationError,
  AuthorizationError,
  BusinessRuleViolationError,
  ConflictError,
  DomainError,
  InvalidValueError,
  NotFoundError,
  TooManyRequestsError,
  type DomainErrorDetail,
} from '../../domain';
import type { HttpResponse } from '../http/http';
import { MalformedRequestError } from './http-errors';

/** Formato padrão de erro da API. */
export type ErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly DomainErrorDetail[];
  };
};

/**
 * Única tradução de erro → HTTP da aplicação. O domínio nunca conhece status
 * HTTP: aqui a categoria do erro decide o status.
 */
export function errorToHttp(error: unknown): HttpResponse & { body: ErrorBody } {
  if (!(error instanceof DomainError)) {
    return {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } },
    };
  }

  // Erro de valor único vira o formato agregado de validação, como o enunciado pede.
  const code = error instanceof InvalidValueError ? 'VALIDATION_ERROR' : error.code;
  const message = error instanceof InvalidValueError ? 'Dados inválidos' : error.message;

  return {
    status: statusOf(error),
    body: {
      error: {
        code,
        message,
        ...(error.details.length > 0 && { details: error.details }),
      },
    },
  };
}

function statusOf(error: DomainError): number {
  if (error instanceof InputValidationError) return 400;
  if (error instanceof InvalidValueError) return 400;
  if (error instanceof MalformedRequestError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorizationError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof BusinessRuleViolationError) return 422;
  if (error instanceof TooManyRequestsError) return 429;
  return 500;
}
