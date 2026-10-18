import { beforeEach, describe, expect, it } from 'vitest';

import {
  SERVICE_UNAVAILABLE_CODES,
  ServiceUnavailableError,
  UnauthenticatedError,
} from '../../../../shared-kernel/application';
import { InMemorySessionStore } from '../../../infra';
import { FakeAuthGateway } from '../../testing/fake-auth.gateway';
import { ImmediateRenewalLock } from '../../testing/immediate-renewal.lock';
import { RestoreSessionUseCase } from './restore-session.usecase';

describe('RestoreSessionUseCase', () => {
  let gateway: FakeAuthGateway;
  let sessions: InMemorySessionStore;
  let lock: ImmediateRenewalLock;
  let restore: RestoreSessionUseCase;

  beforeEach(() => {
    gateway = new FakeAuthGateway();
    sessions = new InMemorySessionStore();
    lock = new ImmediateRenewalLock();
    restore = new RestoreSessionUseCase(gateway, sessions, lock);
  });

  it('cookie válido: restaura a sessão (renovando dentro da trava entre abas)', async () => {
    const session = await restore.execute();

    expect(session?.user.email).toBe('admin@fastmeals.com');
    expect(sessions.state()).toMatchObject({ status: 'authenticated' });
    expect(lock.acquisitions).toBe(1);
  });

  it('sem cookie: visitante anônimo, sem aviso de expiração', async () => {
    gateway.renewAnswer = () =>
      Promise.reject(new UnauthenticatedError('INVALID_REFRESH_TOKEN', 'Sessão inválida'));

    await expect(restore.execute()).resolves.toBeNull();
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: null });
  });

  it('API fora do ar: anônimo, e o erro sobe para a interface', async () => {
    const offline = new ServiceUnavailableError(SERVICE_UNAVAILABLE_CODES.network, 'Sem conexão');
    gateway.renewAnswer = () => Promise.reject(offline);

    await expect(restore.execute()).rejects.toBe(offline);
    expect(sessions.state()).toEqual({ status: 'anonymous', endedBy: null });
  });
});
