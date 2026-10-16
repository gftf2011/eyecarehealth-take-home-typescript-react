import { TooManyRequestsError } from '../../../shared-kernel/domain';

export class TooManyLoginAttemptsError extends TooManyRequestsError {
  readonly code = 'TOO_MANY_LOGIN_ATTEMPTS';

  constructor(retryAfterSeconds: number) {
    super('Muitas tentativas de login. Aguarde antes de tentar novamente.', [
      { retryAfterSeconds },
    ]);
  }
}
