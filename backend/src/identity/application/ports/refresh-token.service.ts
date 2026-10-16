import type { RefreshSessionId, UserId } from '../../domain';

export type RefreshTokenClaims = {
  readonly sessionId: RefreshSessionId;
  readonly userId: UserId;
};

/**
 * Emite e lê refresh tokens. O token identifica a sessão (`sessionId`); se ele
 * ainda é o token vigente daquela sessão é decidido pelo agregado
 * `RefreshSession`, comparando hashes.
 */
export interface RefreshTokenService {
  issue(claims: RefreshTokenClaims, issuedAt: Date, expiresAt: Date): Promise<string>;
  /** Lança `InvalidRefreshTokenError` se o token for inválido ou estiver vencido. */
  verify(token: string): Promise<RefreshTokenClaims>;
}
