import { z } from 'zod';

import {
  BusinessRuleRejectedError,
  ForbiddenError,
  InputValidationError,
  RateLimitedError,
  RequestConflictError,
  ResourceNotFoundError,
  SERVICE_UNAVAILABLE_CODES,
  ServiceUnavailableError,
  UnauthenticatedError,
} from '../../application';
import type { DomainError } from '../../domain';

const fieldDetailSchema = z.object({ field: z.string(), message: z.string() });

/**
 * Formato padrão de erro da API: `{ error: { code, message, details? } }`.
 * Os detalhes podem ser de outros tipos (ex.: `{ deliveryPersonId }` num
 * `409`): só os por campo são usados, os outros não invalidam o erro.
 */
const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(z.unknown())
      .optional()
      .default([])
      .transform((details) => details.flatMap((detail) => {
        const parsed = fieldDetailSchema.safeParse(detail);
        return parsed.success ? [parsed.data] : [];
      })),
  }),
});

const SERVER_ERROR_MESSAGE = 'O servidor encontrou um erro. Tente novamente em instantes.';

/** No 503, só código e mensagem importam (os detalhes variam: tempo limite etc.). */
const unavailableBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string().min(1) }) });

/** Traduz uma resposta de erro da API para a categoria correspondente ao status. */
export function toRequestError(
  status: number,
  body: unknown,
  retryAfterHeader: string | null,
): DomainError {
  // 503 com corpo da API: indisponibilidade temporária com motivo (ex.: otimizador
  // ocupado), cuja mensagem orienta o usuário melhor que um "erro no servidor".
  if (status === 503) {
    const unavailable = unavailableBodySchema.safeParse(body);
    if (unavailable.success) {
      return new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.temporarilyUnavailable, unavailable.data.error.message);
    }
  }

  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success || status >= 500) {
    return new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.server, SERVER_ERROR_MESSAGE);
  }

  const { code, message, details } = parsed.data.error;
  switch (status) {
    case 400:
      return new InputValidationError(details, message);
    case 401:
      return new UnauthenticatedError(code, message);
    case 403:
      return new ForbiddenError(code, message);
    case 404:
      return new ResourceNotFoundError(code, message);
    case 409:
      return new RequestConflictError(code, message);
    case 429:
      return new RateLimitedError(code, message, parseRetryAfter(retryAfterHeader));
    default:
      return new BusinessRuleRejectedError(code, message, details);
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
