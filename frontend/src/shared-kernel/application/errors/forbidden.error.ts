import { AuthorizationError } from '../../domain';

/** `403`: o perfil do usuário não tem a permissão exigida. */
export class ForbiddenError extends AuthorizationError {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
