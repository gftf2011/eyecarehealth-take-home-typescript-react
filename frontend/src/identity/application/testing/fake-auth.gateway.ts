import type { AuthGateway, IssuedSession } from '..';

type Answer<T> = () => Promise<T>;

export function issuedSession(overrides: Partial<IssuedSession> = {}): IssuedSession {
  return {
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date('2026-10-17T12:15:00Z'),
    user: { id: 'user-1', email: 'admin@fastmeals.com', role: 'admin' },
    ...overrides,
  };
}

/** Gateway programável: cada método responde o que o teste configurar e conta as chamadas. */
export class FakeAuthGateway implements AuthGateway {
  loginAnswer: Answer<IssuedSession> = () => Promise.resolve(issuedSession());
  renewAnswer: Answer<IssuedSession> = () => Promise.resolve(issuedSession({ accessToken: 'access-2' }));
  logoutAnswer: Answer<void> = () => Promise.resolve();

  readonly logins: { email: string; password: string }[] = [];
  renewals = 0;
  logouts = 0;

  login(credentials: { email: string; password: string }): Promise<IssuedSession> {
    this.logins.push(credentials);
    return this.loginAnswer();
  }

  renew(): Promise<IssuedSession> {
    this.renewals += 1;
    return this.renewAnswer();
  }

  logout(): Promise<void> {
    this.logouts += 1;
    return this.logoutAnswer();
  }
}
