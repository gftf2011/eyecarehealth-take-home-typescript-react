import type { RoleValue } from '../../domain';

/** O que o access token carrega: só o necessário para autorizar a requisição. */
export type AccessTokenClaims = {
  readonly userId: string;
  readonly role: RoleValue;
};

export type IssuedToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

/** Emite access tokens de vida curta (JWT na infra). */
export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims, issuedAt: Date, expiresAt: Date): Promise<string>;
}

/**
 * Verifica assinatura e validade do access token. Lança `TokenExpiredError`
 * (vencido) ou `InvalidTokenError` (ausente, malformado, assinatura inválida).
 */
export interface AccessTokenVerifier {
  verify(token: string): Promise<AccessTokenClaims>;
}
