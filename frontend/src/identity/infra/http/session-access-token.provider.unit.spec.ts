import { beforeEach, describe, expect, it } from 'vitest';

import type { UseCase } from '../../../shared-kernel/application';
import type { SessionDto } from '../../application';
import { NOW, buildSession } from '../../domain/session/testing/session.fixture';
import { InMemorySessionStore } from '../session/in-memory-session.store';
import { SessionAccessTokenProvider } from './session-access-token.provider';

/** Renovação controlada pelo teste: troca o token na store quando `finish()` é chamado. */
class ControlledRenewal implements UseCase<void, SessionDto | null> {
  executions = 0;
  #pending: (() => void)[] = [];

  constructor(private readonly sessions: InMemorySessionStore) {}

  execute(): Promise<SessionDto | null> {
    this.executions += 1;
    return new Promise((resolve) => {
      this.#pending.push(() => {
        this.sessions.authenticate(buildSession({ accessToken: `renovado-${this.executions}` }));
        resolve(null);
      });
    });
  }

  finish(): void {
    for (const resolve of this.#pending.splice(0)) resolve();
  }
}

describe('SessionAccessTokenProvider', () => {
  const clock = { now: () => NOW };
  let sessions: InMemorySessionStore;
  let renewal: ControlledRenewal;
  let provider: SessionAccessTokenProvider;

  beforeEach(() => {
    sessions = new InMemorySessionStore();
    renewal = new ControlledRenewal(sessions);
    provider = new SessionAccessTokenProvider(sessions, renewal, clock, 30_000);
  });

  it('sem sessão não há token', async () => {
    await expect(provider.currentToken()).resolves.toBeNull();
  });

  it('token com folga: usa o atual sem renovar', async () => {
    sessions.authenticate(buildSession({ accessToken: 'atual' }));

    await expect(provider.currentToken()).resolves.toBe('atual');
    expect(renewal.executions).toBe(0);
  });

  it('token vencendo: renova antes de usar', async () => {
    sessions.authenticate(buildSession({ expiresAt: new Date(NOW.getTime() + 10_000) }));

    const token = provider.currentToken();
    renewal.finish();

    await expect(token).resolves.toBe('renovado-1');
  });

  it('várias requisições ao mesmo tempo compartilham uma renovação', async () => {
    sessions.authenticate(buildSession({ accessToken: 'rejeitado' }));

    const tokens = Promise.all([
      provider.tokenRejected('rejeitado'),
      provider.tokenRejected('rejeitado'),
      provider.tokenRejected('rejeitado'),
    ]);
    renewal.finish();

    await expect(tokens).resolves.toEqual(['renovado-1', 'renovado-1', 'renovado-1']);
    expect(renewal.executions).toBe(1);
  });

  it('401 de um token que já foi trocado: reaproveita o novo sem renovar', async () => {
    sessions.authenticate(buildSession({ accessToken: 'novo' }));

    await expect(provider.tokenRejected('antigo')).resolves.toBe('novo');
    expect(renewal.executions).toBe(0);
  });

  it('renovação recusada (sessão expirou): devolve null', async () => {
    sessions.authenticate(buildSession({ accessToken: 'rejeitado' }));
    const expiring = new SessionAccessTokenProvider(
      sessions,
      {
        execute: () => {
          sessions.end('expired');
          return Promise.resolve(null);
        },
      },
      clock,
    );

    await expect(expiring.tokenRejected('rejeitado')).resolves.toBeNull();
  });
});
