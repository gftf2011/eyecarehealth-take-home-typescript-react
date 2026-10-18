import { TooManyRequestsError } from '../../domain';

/** `429`: limite de requisições ou de tentativas de login excedido. */
export class RateLimitedError extends TooManyRequestsError {
  constructor(
    readonly code: string,
    message: string,
    /** Segundos até poder tentar de novo (`Retry-After`), quando informado. */
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
  }
}
