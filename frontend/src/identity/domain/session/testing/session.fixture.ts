import { Email, Role, Session, type RoleValue } from '../..';

export const NOW = new Date('2026-10-17T12:00:00Z');
export const FIFTEEN_MINUTES = 15 * 60_000;

export function buildSession(
  overrides: Partial<{
    userId: string;
    email: string;
    role: RoleValue;
    accessToken: string;
    expiresAt: Date;
  }> = {},
): Session {
  return Session.start({
    userId: overrides.userId ?? 'user-1',
    email: Email.create(overrides.email ?? 'admin@fastmeals.com'),
    role: Role.of(overrides.role ?? 'admin'),
    accessToken: overrides.accessToken ?? 'access-1',
    accessTokenExpiresAt: overrides.expiresAt ?? new Date(NOW.getTime() + FIFTEEN_MINUTES),
  });
}
