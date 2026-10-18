import { beforeEach, describe, expect, it } from 'vitest';

import {
  SERVICE_UNAVAILABLE_CODES,
  ServiceUnavailableError,
} from '../../../../shared-kernel/application';
import { buildSession } from '../../../domain/session/testing/session.fixture';
import { InMemorySessionStore } from '../../../infra';
import { FakeAuthGateway } from '../../testing/fake-auth.gateway';
import { LogoutUseCase } from './logout.usecase';

describe('LogoutUseCase', () => {
  let gateway: FakeAuthGateway;
  let sessions: InMemorySessionStore;
  let logout: LogoutUseCase;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    sessions = new InMemorySessionStore();
    logout = new LogoutUseCase(gateway, sessions);
    sessions.authenticate(buildSession());
  });

  it('revoga no servidor e encerra a sessão local', async () => {
    await logout.execute();

    expect(gateway.logouts).toBe(1);
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: 'signed-out' });
  });

  it('API fora do ar: sai do mesmo jeito', async () => {
    gateway.logoutAnswer = () =>
      Promise.reject(new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.network, 'Sem conexão'));

    await expect(logout.execute()).resolves.toBeUndefined();
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: 'signed-out' });
  });

  it('bug inesperado: sai, mas não esconde o erro', async () => {
    gateway.logoutAnswer = () => Promise.reject(new TypeError('bug'));

    await expect(logout.execute()).rejects.toThrow(TypeError);
    expect(sessions.state().status).toBe('anonymous');
  });
});
