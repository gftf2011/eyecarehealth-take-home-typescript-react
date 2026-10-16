import type { AuthenticatedUser } from './authenticated-user';

/**
 * Port de autenticação da camada HTTP: recebe o header `Authorization` e
 * devolve o usuário, ou lança `AuthenticationError` (401). A implementação
 * real (JWT) vem do contexto Identity.
 */
export interface Authenticator {
  authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedUser>;
}
