import type { Permission } from '../../../shared-kernel/domain';

/** Quem está conectado: identidade, permissões e até quando o token vale. */
export type RealtimePrincipal = {
  readonly id: string;
  readonly permissions: readonly Permission[];
  readonly expiresAt: Date;
};

/**
 * Port de autenticação das sessões de tempo real: valida o access token
 * enviado na mensagem `auth`. Lança `AuthenticationError` para token ausente,
 * inválido ou expirado. A implementação real (JWT) vem do contexto Identity.
 */
export interface RealtimeAuthenticator {
  authenticateToken(accessToken: string): Promise<RealtimePrincipal>;
}
