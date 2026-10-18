import { beforeEach, describe, expect, it } from 'vitest';

import {
  SERVICE_UNAVAILABLE_CODES,
  ServiceUnavailableError,
  UnauthenticatedError,
} from '../../../../shared-kernel/application';
import { buildSession } from '../../../domain/session/testing/session.fixture';
import { InMemorySessionStore } from '../../../infra';
import { FakeAuthGateway, issuedSession } from '../../testing/fake-auth.gateway';
import { ImmediateRenewalLock } from '../../testing/immediate-renewal.lock';
import { RenewSessionUseCase } from './renew-session.usecase';

describe('RenewSessionUseCase', () => {
  let gateway: FakeAuthGateway;
  let sessions: InMemorySessionStore;
  let renew: RenewSessionUseCase;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    sessions = new InMemorySessionStore();
    renew = new RenewSessionUseCase(gateway, sessions, new ImmediateRenewalLock());
    sessions.authenticate(buildSession({ accessToken: 'access-1' }));
  });

  it('troca o token da sessão ativa', async () => {
    await renew.execute();

    const state = sessions.state();
    expect(state.status === 'authenticated' && state.session.accessToken).toBe('access-2');
  });

  it('refresh recusado: a sessão expirou', async () => {
    gateway.renewAnswer = () =>
      Promise.reject(new UnauthenticatedError('INVALID_REFRESH_TOKEN', 'Sessão inválida'));

    await expect(renew.execute()).resolves.toBeNull();
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: 'expired' });
  });

  it('falha de rede: mantém a sessão e propaga o erro', async () => {
    const offline = new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.network, 'Sem conexão');
    gateway.renewAnswer = () => Promise.reject(offline);

    await expect(renew.execute()).rejects.toBe(offline);
    expect(sessions.state().status).toBe('authenticated');
  });

  it('sem sessão: não chama a API', async () => {
    sessions.end('signed-out');

    await expect(renew.execute()).resolves.toBeNull();
    expect(gateway.renewals).toBe(0);
  });

  it('logout durante a renovação: não ressuscita a sessão', async () => {
    gateway.renewAnswer = () => {
      sessions.end('signed-out');
      return Promise.resolve(issuedSession({ accessToken: 'access-2' }));
    };

    await expect(renew.execute()).resolves.toBeNull();
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: 'signed-out' });
  });
});
