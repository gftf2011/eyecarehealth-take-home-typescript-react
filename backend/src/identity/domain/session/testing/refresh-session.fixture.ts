import {
  RefreshSession,
  RefreshSessionId,
  TokenHash,
  UserId,
  type StartRefreshSessionParams,
} from '../..';

const DAY_MS = 24 * 60 * 60 * 1000;

export const STARTED_AT = new Date('2025-01-01T08:00:00Z');
export const ONE_HOUR_LATER = new Date(STARTED_AT.getTime() + 60 * 60 * 1000);
/** Refresh token expira em 7 dias, conforme o enunciado. */
export const SEVEN_DAYS_LATER = new Date(STARTED_AT.getTime() + 7 * DAY_MS);

export const FIRST_TOKEN = TokenHash.fromHex('a'.repeat(64));
export const SECOND_TOKEN = TokenHash.fromHex('b'.repeat(64));
export const THIRD_TOKEN = TokenHash.fromHex('c'.repeat(64));

export function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function buildStartParams(
  overrides: Partial<StartRefreshSessionParams> = {},
): StartRefreshSessionParams {
  return {
    id: RefreshSessionId.generate(),
    userId: UserId.generate(),
    tokenHash: FIRST_TOKEN,
    expiresAt: SEVEN_DAYS_LATER,
    now: STARTED_AT,
    ...overrides,
  };
}

/** Sessão recém-iniciada, já sem o evento de início. */
export function buildSession(overrides: Partial<StartRefreshSessionParams> = {}): RefreshSession {
  const session = RefreshSession.start(buildStartParams(overrides));
  session.pullDomainEvents();
  return session;
}
