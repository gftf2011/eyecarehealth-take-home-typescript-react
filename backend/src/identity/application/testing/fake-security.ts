import { createHash } from 'node:crypto';

import { PasswordHash, RefreshSessionId, UserId, InvalidRefreshTokenError } from '../../domain';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
} from '../ports/access-token.service';
import type { PasswordHasher } from '../ports/password-hasher';
import type { RefreshTokenClaims, RefreshTokenService } from '../ports/refresh-token.service';

const BCRYPT_ALPHABET = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Hasher determinístico e instantâneo para testes de unidade. Gera hashes no
 * formato bcrypt (exigido pelo domínio), derivados da senha.
 */
export class FakePasswordHasher implements PasswordHasher {
  verifications = 0;

  async hash(plainPassword: string): Promise<PasswordHash> {
    return PasswordHash.fromHash(fakeBcrypt(plainPassword));
  }

  async verify(plainPassword: string, hash: PasswordHash): Promise<boolean> {
    this.verifications += 1;
    return hash.value === fakeBcrypt(plainPassword);
  }
}

function fakeBcrypt(plain: string): string {
  const digest = createHash('sha512').update(plain).digest();
  const body = Array.from(digest.subarray(0, 53), (byte) => BCRYPT_ALPHABET[byte % 64]).join('');
  return `$2b$10$${body}`;
}

/** Access token legível: `access|<userId>|<role>|<expiresAt>`. */
export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  async issue(claims: AccessTokenClaims, _issuedAt: Date, expiresAt: Date): Promise<string> {
    return `access|${claims.userId}|${claims.role}|${expiresAt.toISOString()}`;
  }
}

/** Refresh token único por emissão: `refresh|<sessionId>|<userId>|<n>`. */
export class FakeRefreshTokenService implements RefreshTokenService {
  #issued = 0;

  async issue(claims: RefreshTokenClaims): Promise<string> {
    this.#issued += 1;
    return `refresh|${claims.sessionId.value}|${claims.userId.value}|${this.#issued}`;
  }

  async verify(token: string): Promise<RefreshTokenClaims> {
    const [prefix, sessionId, userId] = token.split('|');
    if (prefix !== 'refresh' || sessionId === undefined || userId === undefined) {
      throw new InvalidRefreshTokenError('invalid');
    }
    return { sessionId: RefreshSessionId.from(sessionId), userId: UserId.from(userId) };
  }
}
