import { AuthenticationError } from '../../domain';

/** `401`: credenciais inválidas, token ausente, inválido ou expirado. */
export class UnauthenticatedError extends AuthenticationError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
