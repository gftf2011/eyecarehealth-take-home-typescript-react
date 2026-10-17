import { describe, expect, it } from 'vitest';

import {
  InvalidRefreshTokenError,
  InvalidSessionExpirationError,
  RefreshSession,
  RefreshSessionRevoked,
  RefreshSessionRotated,
  RefreshSessionStarted,
  type InvalidRefreshTokenReason,
} from '..';
import {
  buildSession,
  buildStartParams,
  FIRST_TOKEN,
  ONE_HOUR_LATER,
  plusDays,
  SECOND_TOKEN,
  SEVEN_DAYS_LATER,
  STARTED_AT,
  THIRD_TOKEN,
} from './testing/refresh-session.fixture';

function rejectionReason(act: () => void): InvalidRefreshTokenReason | undefined {
  try {
    act();
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) return error.reason;
    throw error;
  }
  return undefined;
}

describe('RefreshSession', () => {
  describe('start', () => {
    it('inicia ativa e emite RefreshSessionStarted', () => {
      const params = buildStartParams();

      const session = RefreshSession.start(params);

      expect(session.isActiveAt(STARTED_AT)).toBe(true);
      const [event] = session.pullDomainEvents();
      expect(event).toBeInstanceOf(RefreshSessionStarted);
      expect(event?.payload).toEqual({
        userId: params.userId.value,
        expiresAt: SEVEN_DAYS_LATER.toISOString(),
      });
    });

    it('rejeita expiração que não é futura', () => {
      expect(() => RefreshSession.start(buildStartParams({ expiresAt: STARTED_AT }))).toThrow(
        InvalidSessionExpirationError,
      );
    });

    it('expira exatamente no instante de expiresAt', () => {
      const session = buildSession();

      expect(session.isActiveAt(new Date(SEVEN_DAYS_LATER.getTime() - 1))).toBe(true);
      expect(session.isActiveAt(SEVEN_DAYS_LATER)).toBe(false);
    });
  });

  describe('rotate', () => {
    it('troca o token atual e emite RefreshSessionRotated', () => {
      const session = buildSession();
      const nextExpiresAt = plusDays(ONE_HOUR_LATER, 7);

      session.rotate({
        presentedTokenHash: FIRST_TOKEN,
        nextTokenHash: SECOND_TOKEN,
        nextExpiresAt,
        now: ONE_HOUR_LATER,
      });

      expect(session.tokenHash.equals(SECOND_TOKEN)).toBe(true);
      expect(session.expiresAt).toEqual(nextExpiresAt);
      const [event] = session.pullDomainEvents();
      expect(event).toBeInstanceOf(RefreshSessionRotated);
    });

    it('detecta reuso de token antigo e revoga a sessão inteira', () => {
      const session = buildSession();
      session.rotate({
        presentedTokenHash: FIRST_TOKEN,
        nextTokenHash: SECOND_TOKEN,
        nextExpiresAt: SEVEN_DAYS_LATER,
        now: ONE_HOUR_LATER,
      });
      session.pullDomainEvents();

      const reason = rejectionReason(() =>
        session.rotate({
          presentedTokenHash: FIRST_TOKEN,
          nextTokenHash: THIRD_TOKEN,
          nextExpiresAt: SEVEN_DAYS_LATER,
          now: ONE_HOUR_LATER,
        }),
      );

      expect(reason).toBe('reuse-detected');
      expect(session.isRevoked).toBe(true);
      expect(session.revocationReason).toBe('reuse-detected');
      const [event] = session.pullDomainEvents();
      expect(event).toBeInstanceOf(RefreshSessionRevoked);
      expect(event?.payload).toEqual({ reason: 'reuse-detected' });

      // Após a revogação, nem o token legítimo mais recente renova a sessão.
      expect(
        rejectionReason(() =>
          session.rotate({
            presentedTokenHash: SECOND_TOKEN,
            nextTokenHash: THIRD_TOKEN,
            nextExpiresAt: SEVEN_DAYS_LATER,
            now: ONE_HOUR_LATER,
          }),
        ),
      ).toBe('revoked');
    });

    it('recusa sessão expirada sem alterá-la', () => {
      const session = buildSession();

      const reason = rejectionReason(() =>
        session.rotate({
          presentedTokenHash: FIRST_TOKEN,
          nextTokenHash: SECOND_TOKEN,
          nextExpiresAt: plusDays(SEVEN_DAYS_LATER, 7),
          now: SEVEN_DAYS_LATER,
        }),
      );

      expect(reason).toBe('expired');
      expect(session.tokenHash.equals(FIRST_TOKEN)).toBe(true);
      expect(session.domainEvents).toHaveLength(0);
    });

    it('usa mensagem genérica para o cliente', () => {
      const session = buildSession();
      session.revoke('logout', ONE_HOUR_LATER);

      expect(() =>
        session.rotate({
          presentedTokenHash: FIRST_TOKEN,
          nextTokenHash: SECOND_TOKEN,
          nextExpiresAt: SEVEN_DAYS_LATER,
          now: ONE_HOUR_LATER,
        }),
      ).toThrow(
        expect.objectContaining({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido ou expirado',
        }),
      );
    });
  });

  describe('revoke', () => {
    it('revoga uma única vez (idempotente)', () => {
      const session = buildSession();

      session.revoke('logout', ONE_HOUR_LATER);
      session.revoke('reuse-detected', SEVEN_DAYS_LATER);

      expect(session.revocationReason).toBe('logout');
      expect(session.revokedAt).toEqual(ONE_HOUR_LATER);
      expect(session.pullDomainEvents()).toHaveLength(1);
    });
  });

  it('reidrata o estado sem emitir eventos', () => {
    const original = buildSession();

    const restored = RefreshSession.reconstitute(original.id, original.snapshot());

    expect(restored.snapshot()).toEqual(original.snapshot());
    expect(restored.domainEvents).toHaveLength(0);
  });
});
