import type { RefreshSessionId, TokenHash, User, UserId } from '../../domain';
import type { AuthPolicy } from '../config/auth-policy';
import type { AccessTokenIssuer, IssuedToken } from '../ports/access-token.service';
import type { RefreshTokenService } from '../ports/refresh-token.service';
import type { TokenHasher } from '../ports/token-hasher';

export type IssuedRefreshToken = IssuedToken & { readonly hash: TokenHash };

/** Emite os tokens de uma sessão segundo a política de autenticação. */
export class AuthTokenFactory {
  constructor(
    private readonly accessTokens: AccessTokenIssuer,
    private readonly refreshTokens: RefreshTokenService,
    private readonly tokenHasher: TokenHasher,
    private readonly policy: AuthPolicy,
  ) {}

  async accessToken(user: User, now: Date): Promise<IssuedToken> {
    const expiresAt = new Date(now.getTime() + this.policy.accessTokenTtlMs);
    const token = await this.accessTokens.issue(
      { userId: user.id.value, role: user.role.value },
      now,
      expiresAt,
    );
    return { token, expiresAt };
  }

  async refreshToken(sessionId: RefreshSessionId, userId: UserId, now: Date): Promise<IssuedRefreshToken> {
    const expiresAt = new Date(now.getTime() + this.policy.refreshTokenTtlMs);
    const token = await this.refreshTokens.issue({ sessionId, userId }, now, expiresAt);
    return { token, expiresAt, hash: this.tokenHasher.hash(token) };
  }
}
