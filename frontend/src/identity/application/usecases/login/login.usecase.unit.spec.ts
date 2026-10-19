import { beforeEach, describe, expect, it } from 'vitest';

import {
  InputValidationError,
  RateLimitedError,
  UnauthenticatedError,
} from '../../../../shared-kernel/application';
import { InMemorySessionStore } from '../../../infra';
import { FakeAuthGateway, issuedSession } from '../../testing/fake-auth.gateway';
import { LoginUseCase } from './login.usecase';

describe('LoginUseCase', () => {
  let gateway: FakeAuthGateway;
  let sessions: InMemorySessionStore;
  let login: LoginUseCase;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    sessions = new InMemorySessionStore();
    login = new LoginUseCase(gateway, sessions);
  });

  it('autentica e devolve o usuário com as permissões do perfil', async () => {
    gateway.loginAnswer = () =>
      Promise.resolve(
        issuedSession({ user: { id: 'user-viewer', email: 'viewer@fastmeals.com', role: 'viewer' } }),
      );

    const session = await login.execute({ email: ' Viewer@FastMeals.com ', password: 'Viewer@123' });

    expect(gateway.logins).toEqual([{ email: 'viewer@fastmeals.com', password: 'Viewer@123' }]);
    expect(session.user).toEqual({
      id: 'user-viewer',
      email: 'viewer@fastmeals.com',
      role: 'viewer',
      roleLabel: 'Somente leitura',
    });
    expect(session.permissions).toEqual(['products:read', 'orders:read', 'reports:read']);
    expect(sessions.state()).toMatchObject({ status: 'authenticated' });
  });

  it('valida os dois campos antes de chamar a API', async () => {
    const attempt = login.execute({ email: 'invalido', password: '' });

    await expect(attempt).rejects.toThrow(InputValidationError);
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error instanceof InputValidationError ? error.messagesByField() : null).toEqual({
      email: 'Informe um email válido',
      password: 'Informe a senha',
    });
    expect(gateway.logins).toHaveLength(0);
  });

  it.each([
    ['credenciais inválidas', new UnauthenticatedError('INVALID_CREDENTIALS', 'Email ou senha inválidos')],
    ['excesso de tentativas', new RateLimitedError('TOO_MANY_LOGIN_ATTEMPTS', 'Muitas tentativas', 60)],
  ])('%s: propaga o erro e não autentica', async (_, failure) => {
    gateway.loginAnswer = () => Promise.reject(failure);

    await expect(login.execute({ email: 'admin@fastmeals.com', password: 'x' })).rejects.toBe(failure);
    expect(sessions.state()).toEqual({ status: 'restoring' });
  });

  it('recusa uma sessão incoerente vinda da API', async () => {
    gateway.loginAnswer = () =>
      Promise.resolve(issuedSession({ user: { id: 'u', email: 'a@b.com', role: 'superuser' } }));

    await expect(login.execute({ email: 'a@b.com', password: 'x' })).rejects.toThrow('O perfil deve ser');
    expect(sessions.state().status).toBe('restoring');
  });
});
