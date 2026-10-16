import { errors, jwtVerify, SignJWT } from 'jose';

import { InvalidTokenError, TokenExpiredError, type Clock } from '../../../shared-kernel/application';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  AccessTokenVerifier,
} from '../../application/ports/access-token.service';
import { Role } from '../../domain';

const ISSUER = 'fastmeals-api';
const AUDIENCE = 'fastmeals-access';
const ALGORITHM = 'HS256';

/**
 * Access token JWT (HS256). Audiência própria: um refresh token, assinado
 * com outro segredo e outra audiência, nunca é aceito como access token.
 */
export class JoseAccessTokenService implements AccessTokenIssuer, AccessTokenVerifier {
  readonly #secret: Uint8Array;

  constructor(
    secret: string,
    private readonly clock: Clock,
  ) {
    this.#secret = new TextEncoder().encode(secret);
  }

  async issue(claims: AccessTokenClaims, issuedAt: Date, expiresAt: Date): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(toSeconds(issuedAt))
      .setExpirationTime(toSeconds(expiresAt))
      .sign(this.#secret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.#secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: [ALGORITHM],
        currentDate: this.clock.now(),
      });
      const role = typeof payload['role'] === 'string' ? payload['role'] : '';
      if (payload.sub === undefined || !Role.isValid(role)) throw new InvalidTokenError();
      return { userId: payload.sub, role };
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new TokenExpiredError();
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError();
    }
  }
}

function toSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
