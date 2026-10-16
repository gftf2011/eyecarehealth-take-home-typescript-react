import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError, type RateLimitCounter } from '../../../../shared-kernel/application';
import { InvalidCredentialsError, RefreshSessionStarted } from '../../../domain';
import { DEFAULT_AUTH_POLICY } from '../../config/auth-policy';
import { TooManyLoginAttemptsError } from '../../errors/too-many-login-attempts.error';
import { FakeAccessTokenIssuer, FakeRefreshTokenService } from '../../testing/fake-security';
import { ADMIN_PASSWORD, createIdentityTestKit, NOW } from '../../testing/identity-test-kit';
import { AuthTokenFactory } from '../../services/auth-token.factory';
import { LoginUseCase } from './login.usecase';

const MINUTE = 60_000;
const IP = '203.0.113.7';

describe('LoginUseCase', () => {
  let kit: ReturnType<typeof createIdentityTestKit>;

  beforeEach(async () => {
    kit = createIdentityTestKit();
    await kit.givenUser('admin@fastmeals.com', ADMIN_PASSWORD, 'admin');
  });

  it('autentica e abre uma sessão com refresh token rotativo', async () => {
    const result = await kit.login.execute({
      email: 'admin@fastmeals.com',
      password: ADMIN_PASSWORD,
      ipAddress: IP,
    });

    expect(result.user).toMatchObject({ email: 'admin@fastmeals.com', role: 'admin' });
    expect(result.accessToken).toContain('|admin|');
    expect(result.accessTokenExpiresAt).toEqual(new Date(NOW.getTime() + 15 * MINUTE));
    expect(result.refreshTokenExpiresAt).toEqual(new Date(NOW.getTime() + 7 * 24 * 60 * MINUTE));

    const [session] = [...kit.unitOfWork.sessions.values()];
    expect(session?.tokenHash.equals(kit.tokenHasher.hash(result.refreshToken))).toBe(true);
    expect(kit.unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([RefreshSessionStarted]);
  });

  it('aceita o email com outra caixa e espaços', async () => {
    const result = await kit.login.execute({
      email: '  ADMIN@FastMeals.com ',
      password: ADMIN_PASSWORD,
      ipAddress: IP,
    });
    expect(result.user.email).toBe('admin@fastmeals.com');
  });

  it('senha errada → INVALID_CREDENTIALS, sem abrir sessão', async () => {
    await expect(
      kit.login.execute({ email: 'admin@fastmeals.com', password: 'errada', ipAddress: IP }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(kit.unitOfWork.sessions.size).toBe(0);
  });

  it('email inexistente → mesmo erro e mesma verificação de senha (não revela cadastro)', async () => {
    const attempt = kit.login.execute({
      email: 'ninguem@fastmeals.com',
      password: ADMIN_PASSWORD,
      ipAddress: IP,
    });

    await expect(attempt).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha inválidos',
    });
    expect(kit.passwordHasher.verifications).toBe(1);
  });

  it('valida formato de email e senha vazia juntos', async () => {
    const attempt = kit.login.execute({ email: 'admin', password: '', ipAddress: IP });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [{ field: 'email' }, { field: 'password', message: 'Informe a senha' }],
    });
  });

  describe('proteção contra força bruta', () => {
    const attempt = (password: string, ipAddress = IP) =>
      kit.login.execute({ email: 'admin@fastmeals.com', password, ipAddress });

    it('bloqueia o par (email, IP) após 5 tentativas na janela, mesmo com a senha certa', async () => {
      for (let i = 0; i < 5; i += 1) {
        await expect(attempt('errada')).rejects.toBeInstanceOf(InvalidCredentialsError);
      }

      await expect(attempt(ADMIN_PASSWORD)).rejects.toBeInstanceOf(TooManyLoginAttemptsError);
      await expect(attempt(ADMIN_PASSWORD)).rejects.toMatchObject({
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        details: [{ retryAfterSeconds: 60 }],
      });
    });

    it('logins bem-sucedidos não contam: quem acerta a senha nunca é bloqueado', async () => {
      for (let i = 0; i < 10; i += 1) {
        await expect(attempt(ADMIN_PASSWORD)).resolves.toBeDefined();
      }
    });

    it('não afeta o mesmo email vindo de outro IP', async () => {
      for (let i = 0; i < 6; i += 1) await attempt('errada').catch(() => undefined);

      await expect(attempt(ADMIN_PASSWORD, '198.51.100.1')).resolves.toBeDefined();
    });

    it('libera de novo quando a janela expira', async () => {
      for (let i = 0; i < 6; i += 1) await attempt('errada').catch(() => undefined);

      kit.clock.advanceBy(DEFAULT_AUTH_POLICY.loginAttempts.windowMs);

      await expect(attempt(ADMIN_PASSWORD)).resolves.toBeDefined();
    });

    it('com o contador fora do ar, o login continua funcionando (fail-open)', async () => {
      const unavailable = async (): Promise<never> => {
        throw new Error('Redis indisponível');
      };
      const brokenCounter: RateLimitCounter = { hit: unavailable, peek: unavailable };
      const login = new LoginUseCase(
        kit.unitOfWork,
        kit.passwordHasher,
        new AuthTokenFactory(
          new FakeAccessTokenIssuer(),
          new FakeRefreshTokenService(),
          kit.tokenHasher,
          DEFAULT_AUTH_POLICY,
        ),
        brokenCounter,
        DEFAULT_AUTH_POLICY,
        kit.clock,
      );

      await expect(
        login.execute({ email: 'admin@fastmeals.com', password: ADMIN_PASSWORD, ipAddress: IP }),
      ).resolves.toBeDefined();
    });
  });
});
