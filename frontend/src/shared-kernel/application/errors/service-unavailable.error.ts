import { UnavailableError } from '../../domain';

export const SERVICE_UNAVAILABLE_CODES = {
  network: 'NETWORK_ERROR',
  server: 'SERVER_ERROR',
  unexpectedResponse: 'UNEXPECTED_RESPONSE',
} as const;

export type ServiceUnavailableCode =
  (typeof SERVICE_UNAVAILABLE_CODES)[keyof typeof SERVICE_UNAVAILABLE_CODES];

/** Sem conexão, falha interna do servidor (5xx) ou resposta fora do contrato. */
export class ServiceUnavailableError extends UnavailableError {
  constructor(
    readonly code: ServiceUnavailableCode,
    message: string,
  ) {
    super(message);
  }
}
