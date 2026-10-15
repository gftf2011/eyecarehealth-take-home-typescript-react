import type { RefreshSessionRevoked } from './refresh-session-revoked.event';
import type { RefreshSessionRotated } from './refresh-session-rotated.event';
import type { RefreshSessionStarted } from './refresh-session-started.event';

export { REFRESH_SESSION_AGGREGATE_TYPE } from './refresh-session-aggregate-type';
export {
  RefreshSessionRevoked,
  type RefreshSessionRevokedPayload,
} from './refresh-session-revoked.event';
export {
  RefreshSessionRotated,
  type RefreshSessionRotatedPayload,
} from './refresh-session-rotated.event';
export {
  RefreshSessionStarted,
  type RefreshSessionStartedPayload,
} from './refresh-session-started.event';

export type RefreshSessionDomainEvent =
  | RefreshSessionStarted
  | RefreshSessionRotated
  | RefreshSessionRevoked;
