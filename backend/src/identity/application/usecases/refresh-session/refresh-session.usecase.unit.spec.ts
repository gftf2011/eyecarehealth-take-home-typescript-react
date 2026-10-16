import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidRefreshTokenError,
  RefreshSessionRevoked,
  Role,
  type InvalidRefreshTokenReason,
  type User,
} from '../../../domain';
import type { AuthTokensDto } from '../../dtos/auth-tokens.dto';
import { ADMIN_PASSWORD, createIdentityTestKit } from '../../testing/identity-test-kit';

const DAY = 24 * 60 * 60_000;

async function rejectionReason(promise: Promise<unknown>): Promise<InvalidRefreshTokenReason | undefined> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) return error.reason;
    throw error;
  }
  return undefined;
}

describe('RefreshSessionUseCase', () => {
  let kit: ReturnType<typeof createIdentityTestKit>;
  let user: User;
  let session: AuthTokensDto;

  beforeEach(async () => {
    kit = createIdentityTestKit();
    user = await kit.givenUser('admin@fastmeals.com', ADMIN_PASSWORD);
    session = await kit.login.execute({
      email: 'admin@fastmeals.com',
      password: ADMIN_PASSWORD,
      ipAddress: '127.0.0.1',
    });
    kit.clock.advanceBy(10 * 60_000);
  });

  it('rotaciona o refresh token e emite novo access token', async () => {
    const renewed = await kit.refresh.execute({ refreshToken: session.refreshToken });

    expect(renewed.refreshToken).not.toBe(session.refreshToken);
    expect(renewed.accessToken).not.toBe(session.accessToken);
    expect(renewed.refreshTokenExpiresAt.getTime()).toBeGreaterThan(
      session.refreshTokenExpiresAt.getTime(),
    );
    const [stored] = [...kit.unitOfWork.sessions.values()];
    expect(stored?.tokenHash.equals(kit.tokenHasher.hash(renewed.refreshToken))).toBe(true);
  });

  it('o novo access token reflete o papel atual do usuário', async () => {
    user.changeRole(Role.of('viewer'), kit.clock.now());
    kit.unitOfWork.givenUsers(user);

    const renewed = await kit.refresh.execute({ refreshToken: session.refreshToken });

    expect(renewed.user.role).toBe('viewer');
    expect(renewed.accessToken).toContain('|viewer|');
  });

  it('reuso de token antigo revoga a sessão inteira — e a revogação é persistida', async () => {
    const renewed = await kit.refresh.execute({ refreshToken: session.refreshToken });

    expect(await rejectionReason(kit.refresh.execute({ refreshToken: session.refreshToken }))).toBe(
      'reuse-detected',
    );

    const [sessionId] = [...kit.unitOfWork.sessions.keys()];
    expect(kit.unitOfWork.committedSession(sessionId ?? '')?.revocationReason).toBe('reuse-detected');
    expect(kit.unitOfWork.publishedEvents.some((event) => event instanceof RefreshSessionRevoked)).toBe(true);

    // Nem o token legítimo mais recente vale depois disso.
    expect(await rejectionReason(kit.refresh.execute({ refreshToken: renewed.refreshToken }))).toBe(
      'revoked',
    );
  });

  it('recusa sessão expirada', async () => {
    kit.clock.advanceBy(8 * DAY);

    expect(await rejectionReason(kit.refresh.execute({ refreshToken: session.refreshToken }))).toBe(
      'expired',
    );
  });

  it.each([
    [undefined, 'not-found'],
    ['', 'not-found'],
    ['lixo', 'invalid'],
    ['refresh|00000000-0000-4000-8000-000000000000|00000000-0000-4000-8000-000000000001|1', 'not-found'],
  ] as const)('token %j → INVALID_REFRESH_TOKEN (%s)', async (refreshToken, reason) => {
    expect(await rejectionReason(kit.refresh.execute({ refreshToken }))).toBe(reason);
  });
});
