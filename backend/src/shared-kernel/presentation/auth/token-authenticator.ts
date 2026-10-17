import type { AuthenticatedUser } from './authenticated-user';

/** Usuário de um token verificado, com o instante em que a autenticação expira. */
export type TokenPrincipal = AuthenticatedUser & {
  readonly expiresAt: Date;
};

/**
 * Autentica um access token já extraído (sem header HTTP), para canais que
 * não usam `Authorization` — ex.: a mensagem de autenticação do WebSocket.
 * Lança `AuthenticationError` (token ausente, inválido ou expirado). A
 * implementação real (JWT) vem do contexto Identity.
 */
export interface TokenAuthenticator {
  authenticateToken(accessToken: string): Promise<TokenPrincipal>;
}
