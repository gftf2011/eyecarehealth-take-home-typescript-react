import { randomUUID } from 'node:crypto';

import { errors, jwtVerify, SignJWT } from 'jose';

import type { Clock } from '../../../shared-kernel/application';
import type {
  RefreshTokenClaims,
  RefreshTokenService,
} from '../../application/ports/refresh-token.service';
import { InvalidRefreshTokenError, RefreshSessionId, UserId } from '../../domain';

const ISSUER = 'fastmeals-api';
const AUDIENCE = 'fastmeals-refresh';
const ALGORITHM = 'HS256';

/**
 * Refresh token JWT (HS256, segredo próprio). Carrega o ID da sessão (`sid`)
 * e um `jti` aleatório, para que cada token emitido seja único — inclusive
 * dois emitidos no mesmo segundo para a mesma sessão.
 */
export class JoseRefreshTokenService implements RefreshTokenService {
  readonly #secret: Uint8Array;

  constructor(
    secret: string,
    private readonly clock: Clock,
  ) {
    this.#secret = new TextEncoder().encode(secret);
  }

  async issue(claims: RefreshTokenClaims, issuedAt: Date, expiresAt: Date): Promise<string> {
    return new SignJWT({ sid: claims.sessionId.value })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.userId.value)
      .setJti(randomUUID())
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.#secret);
  }

  async verify(token: string): Promise<RefreshTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.#secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: [ALGORITHM],
        currentDate: this.clock.now(),
      });
      if (typeof payload['sid'] !== 'string' || payload.sub === undefined) {
        throw new InvalidRefreshTokenError('invalid');
      }
      return { sessionId: RefreshSessionId.from(payload['sid']), userId: UserId.from(payload.sub) };
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new InvalidRefreshTokenError('expired');
      throw new InvalidRefreshTokenError('invalid');
    }
  }
}
