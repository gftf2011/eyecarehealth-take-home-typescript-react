import type { RefreshSessionRevoked } from './refresh-session-revoked.event.js';
import type { RefreshSessionRotated } from './refresh-session-rotated.event.js';
import type { RefreshSessionStarted } from './refresh-session-started.event.js';

export { REFRESH_SESSION_AGGREGATE_TYPE } from './refresh-session-aggregate-type.js';
export {
  RefreshSessionRevoked,
  type RefreshSessionRevokedPayload,
} from './refresh-session-revoked.event.js';
export {
  RefreshSessionRotated,
  type RefreshSessionRotatedPayload,
} from './refresh-session-rotated.event.js';
export {
  RefreshSessionStarted,
  type RefreshSessionStartedPayload,
} from './refresh-session-started.event.js';

export type RefreshSessionDomainEvent =
  | RefreshSessionStarted
  | RefreshSessionRotated
  | RefreshSessionRevoked;
