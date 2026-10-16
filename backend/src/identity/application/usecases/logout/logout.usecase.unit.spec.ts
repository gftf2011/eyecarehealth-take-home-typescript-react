import { beforeEach, describe, expect, it } from 'vitest';

import { InvalidRefreshTokenError } from '../../../domain';
import type { AuthTokensDto } from '../../dtos/auth-tokens.dto';
import { ADMIN_PASSWORD, createIdentityTestKit } from '../../testing/identity-test-kit';

describe('LogoutUseCase', () => {
  let kit: ReturnType<typeof createIdentityTestKit>;
  let session: AuthTokensDto;

  beforeEach(async () => {
    kit = createIdentityTestKit();
    await kit.givenUser('admin@fastmeals.com', ADMIN_PASSWORD);
    session = await kit.login.execute({
      email: 'admin@fastmeals.com',
      password: ADMIN_PASSWORD,
      ipAddress: '127.0.0.1',
    });
  });

  it('revoga a sessão: o refresh token deixa de renovar', async () => {
    await kit.logout.execute({ refreshToken: session.refreshToken });

    const [stored] = [...kit.unitOfWork.sessions.values()];
    expect(stored?.revocationReason).toBe('logout');
    await expect(kit.refresh.execute({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('é idempotente', async () => {
    await kit.logout.execute({ refreshToken: session.refreshToken });
    await expect(kit.logout.execute({ refreshToken: session.refreshToken })).resolves.toBeUndefined();
  });

  it.each([undefined, '', 'lixo'])('token %j: não falha nem toca no banco', async (refreshToken) => {
    const commitsBefore = kit.unitOfWork.commits;

    await expect(kit.logout.execute({ refreshToken })).resolves.toBeUndefined();
    expect(kit.unitOfWork.commits).toBe(commitsBefore);
  });
});
