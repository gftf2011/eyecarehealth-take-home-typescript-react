import { AggregateRoot } from '../../../shared-kernel/domain/index';
import type { UserId } from '../user/user-id';
import { InvalidRefreshTokenError, InvalidSessionExpirationError } from './errors/index';
import {
  RefreshSessionRevoked,
  RefreshSessionRotated,
  RefreshSessionStarted,
} from './events/index';
import type { RefreshSessionId } from './refresh-session-id';
import type { RevocationReason } from './value-objects/revocation-reason';
import type { TokenHash } from './value-objects/token-hash';

export type StartRefreshSessionParams = {
  id: RefreshSessionId;
  userId: UserId;
  tokenHash: TokenHash;
  expiresAt: Date;
  now: Date;
};

export type RotateRefreshSessionParams = {
  presentedTokenHash: TokenHash;
  nextTokenHash: TokenHash;
  nextExpiresAt: Date;
  now: Date;
};

export type RefreshSessionSnapshot = {
  userId: UserId;
  tokenHash: TokenHash;
  expiresAt: Date;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: RevocationReason | null;
};

/**
 * Raiz do agregado RefreshSession: uma sessão de login com refresh token
 * rotativo. Cada refresh troca o token (o anterior deixa de valer).
 *
 * Invariantes:
 * - Só o hash do token atual é válido; tokens anteriores não renovam a sessão.
 * - Reapresentar um token antigo indica roubo: a sessão é revogada inteira
 *   (detecção de reuso, recomendação do OAuth 2.0 Security BCP).
 * - Sessão expirada ou revogada não renova.
 */
export class RefreshSession extends AggregateRoot<RefreshSessionId> {
  #state: RefreshSessionSnapshot;

  private constructor(id: RefreshSessionId, state: RefreshSessionSnapshot) {
    super(id);
    this.#state = state;
  }

  static start({ id, userId, tokenHash, expiresAt, now }: StartRefreshSessionParams): RefreshSession {
    ensureExpiresAfter(expiresAt, now);

    const session = new RefreshSession(id, {
      userId,
      tokenHash,
      expiresAt: new Date(expiresAt.getTime()),
      createdAt: new Date(now.getTime()),
      rotatedAt: null,
      revokedAt: null,
      revocationReason: null,
    });
    session.addDomainEvent(
      new RefreshSessionStarted(id, now, {
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
      }),
    );
    return session;
  }

  /** Reidrata a partir da persistência. Não emite eventos. */
  static reconstitute(id: RefreshSessionId, snapshot: RefreshSessionSnapshot): RefreshSession {
    return new RefreshSession(id, { ...snapshot });
  }

  get userId(): UserId {
    return this.#state.userId;
  }

  get tokenHash(): TokenHash {
    return this.#state.tokenHash;
  }

  get expiresAt(): Date {
    return new Date(this.#state.expiresAt.getTime());
  }

  get createdAt(): Date {
    return new Date(this.#state.createdAt.getTime());
  }

  get revokedAt(): Date | null {
    return this.#state.revokedAt === null ? null : new Date(this.#state.revokedAt.getTime());
  }

  get revocationReason(): RevocationReason | null {
    return this.#state.revocationReason;
  }

  get isRevoked(): boolean {
    return this.#state.revokedAt !== null;
  }

  isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.#state.expiresAt.getTime();
  }

  isActiveAt(now: Date): boolean {
    return !this.isRevoked && !this.isExpiredAt(now);
  }

  snapshot(): RefreshSessionSnapshot {
    return {
      ...this.#state,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      rotatedAt: this.#state.rotatedAt === null ? null : new Date(this.#state.rotatedAt.getTime()),
      revokedAt: this.revokedAt,
    };
  }

  /**
   * Troca o token atual por um novo.
   *
   * Em caso de reuso, a sessão é revogada **antes** de lançar o erro: o use
   * case deve persistir o agregado também nesse caminho, para que a revogação
   * tenha efeito.
   */
  rotate({ presentedTokenHash, nextTokenHash, nextExpiresAt, now }: RotateRefreshSessionParams): void {
    if (this.isRevoked) throw new InvalidRefreshTokenError('revoked');
    if (this.isExpiredAt(now)) throw new InvalidRefreshTokenError('expired');

    if (!presentedTokenHash.equals(this.#state.tokenHash)) {
      this.revoke('reuse-detected', now);
      throw new InvalidRefreshTokenError('reuse-detected');
    }

    ensureExpiresAfter(nextExpiresAt, now);

    this.#state = {
      ...this.#state,
      tokenHash: nextTokenHash,
      expiresAt: new Date(nextExpiresAt.getTime()),
      rotatedAt: new Date(now.getTime()),
    };
    this.addDomainEvent(
      new RefreshSessionRotated(this.id, now, { expiresAt: nextExpiresAt.toISOString() }),
    );
  }

  revoke(reason: RevocationReason, now: Date): void {
    if (this.isRevoked) return;

    this.#state = {
      ...this.#state,
      revokedAt: new Date(now.getTime()),
      revocationReason: reason,
    };
    this.addDomainEvent(new RefreshSessionRevoked(this.id, now, { reason }));
  }
}

function ensureExpiresAfter(expiresAt: Date, now: Date): void {
  if (expiresAt.getTime() <= now.getTime()) throw new InvalidSessionExpirationError();
}
